import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument = require('pdfkit');
import * as QRCode from 'qrcode';
import { InvoiceData, InvoiceLineItem } from './types/invoice-data.types';

const PAGE_MARGIN = 40;
const COLUMNS = {
  product: { x: 40, w: 175 },
  sku: { x: 215, w: 65 },
  hsn: { x: 280, w: 55 },
  qty: { x: 335, w: 30 },
  unitPrice: { x: 365, w: 60 },
  discount: { x: 425, w: 50 },
  tax: { x: 475, w: 45 },
  total: { x: 520, w: 55 },
};

/**
 * Renders an InvoiceData object (produced by InvoiceService.composeFromOrder,
 * never recomputed here) to an A4 PDF buffer. Pure presentation — no order,
 * payment, or tax logic lives in this file.
 */
@Injectable()
export class InvoicePdfService {
  async render(data: InvoiceData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    await this.renderHeader(doc, data);
    this.renderBuyerBlock(doc, data);
    this.renderItemsTable(doc, data);
    this.renderTotals(doc, data);
    this.renderPaymentAndShipment(doc, data);
    await this.renderQrCode(doc, data);
    this.renderFooter(doc);

    doc.end();
    return done;
  }

  private async renderHeader(doc: PDFKit.PDFDocument, data: InvoiceData): Promise<void> {
    const logoPath = resolveLocalLogoPath(data.seller.logo);
    let textX = PAGE_MARGIN;

    if (logoPath) {
      try {
        doc.image(logoPath, PAGE_MARGIN, PAGE_MARGIN, { width: 56, height: 56, fit: [56, 56] });
        textX = PAGE_MARGIN + 68;
      } catch {
        // Corrupt/unsupported image file — fall back to text-only header.
      }
    }

    doc.font('Helvetica-Bold').fontSize(14).text(data.seller.legalBusinessName ?? data.seller.storeName, textX, PAGE_MARGIN);
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    let y = PAGE_MARGIN + 18;
    if (data.seller.gstin) { doc.text(`GSTIN: ${data.seller.gstin}`, textX, y); y += 12; }
    if (data.seller.address) {
      const a = data.seller.address;
      const line = [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(', ');
      doc.text(line, textX, y, { width: 300 });
      y += 12;
    }
    if (data.seller.phone) { doc.text(`Phone: ${data.seller.phone}`, textX, y); y += 12; }
    if (data.seller.email) { doc.text(`Email: ${data.seller.email}`, textX, y); }

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000000').text('TAX INVOICE', 350, PAGE_MARGIN, { width: 205, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#444444');
    doc.text(`Invoice #: ${data.invoiceNumber}`, 350, PAGE_MARGIN + 22, { width: 205, align: 'right' });
    doc.text(`Invoice Date: ${formatDate(data.invoiceDate)}`, 350, PAGE_MARGIN + 34, { width: 205, align: 'right' });
    doc.text(`Order #: ${data.order.orderNumber}`, 350, PAGE_MARGIN + 46, { width: 205, align: 'right' });
    doc.text(`Order Date: ${formatDate(data.order.createdAt)}`, 350, PAGE_MARGIN + 58, { width: 205, align: 'right' });

    doc.moveTo(PAGE_MARGIN, 130).lineTo(555, 130).strokeColor('#CCCCCC').stroke();
    doc.y = 140;
  }

  private renderBuyerBlock(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Bill To', PAGE_MARGIN, top);
    doc.font('Helvetica').fontSize(9).fillColor('#333333');
    let y = top + 14;
    doc.text(data.buyer.name, PAGE_MARGIN, y, { width: 250 }); y += 12;
    if (data.buyer.billingAddress) {
      const a = data.buyer.billingAddress;
      doc.text(a.line1 + (a.line2 ? `, ${a.line2}` : ''), PAGE_MARGIN, y, { width: 250 }); y += 12;
      doc.text(`${a.city}, ${a.state} ${a.postalCode}`, PAGE_MARGIN, y, { width: 250 }); y += 12;
      doc.text(a.country, PAGE_MARGIN, y, { width: 250 }); y += 12;
      if (a.phone) { doc.text(`Phone: ${a.phone}`, PAGE_MARGIN, y, { width: 250 }); y += 12; }
    } else {
      doc.text('Not available', PAGE_MARGIN, y); y += 12;
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Ship To', 300, top);
    doc.font('Helvetica').fontSize(9).fillColor('#333333');
    let y2 = top + 14;
    if (data.buyer.shippingAddress) {
      const a = data.buyer.shippingAddress;
      doc.text(`${a.firstName} ${a.lastName}`, 300, y2, { width: 255 }); y2 += 12;
      doc.text(a.line1 + (a.line2 ? `, ${a.line2}` : ''), 300, y2, { width: 255 }); y2 += 12;
      doc.text(`${a.city}, ${a.state} ${a.postalCode}`, 300, y2, { width: 255 }); y2 += 12;
      doc.text(a.country, 300, y2, { width: 255 }); y2 += 12;
    } else {
      doc.text('Not available', 300, y2); y2 += 12;
    }

    doc.y = Math.max(y, y2) + 10;
  }

  private renderItemsTable(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    this.renderTableHeader(doc);

    doc.font('Helvetica').fontSize(8).fillColor('#222222');
    for (const item of data.items) {
      this.ensureSpace(doc, 40);
      this.renderTableRow(doc, item);
    }
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(555, doc.y).strokeColor('#CCCCCC').stroke();
    doc.y += 10;
  }

  private renderTableHeader(doc: PDFKit.PDFDocument): void {
    this.ensureSpace(doc, 30);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000');
    doc.text('Product', COLUMNS.product.x, y, { width: COLUMNS.product.w });
    doc.text('SKU', COLUMNS.sku.x, y, { width: COLUMNS.sku.w });
    doc.text('HSN', COLUMNS.hsn.x, y, { width: COLUMNS.hsn.w });
    doc.text('Qty', COLUMNS.qty.x, y, { width: COLUMNS.qty.w });
    doc.text('Unit Price', COLUMNS.unitPrice.x, y, { width: COLUMNS.unitPrice.w });
    doc.text('Discount', COLUMNS.discount.x, y, { width: COLUMNS.discount.w });
    doc.text('Tax', COLUMNS.tax.x, y, { width: COLUMNS.tax.w });
    doc.text('Total', COLUMNS.total.x, y, { width: COLUMNS.total.w, align: 'right' });
    doc.y = y + 14;
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(555, doc.y).strokeColor('#000000').stroke();
    doc.y += 4;
  }

  private renderTableRow(doc: PDFKit.PDFDocument, item: InvoiceLineItem): void {
    const y = doc.y;
    const name = item.variantName ? `${item.productName} (${item.variantName})` : item.productName;
    doc.text(name, COLUMNS.product.x, y, { width: COLUMNS.product.w });
    doc.text(item.sku, COLUMNS.sku.x, y, { width: COLUMNS.sku.w });
    doc.text(item.hsn ?? '-', COLUMNS.hsn.x, y, { width: COLUMNS.hsn.w });
    doc.text(String(item.quantity), COLUMNS.qty.x, y, { width: COLUMNS.qty.w });
    doc.text(money(item.unitPrice), COLUMNS.unitPrice.x, y, { width: COLUMNS.unitPrice.w });
    doc.text(money(item.discount), COLUMNS.discount.x, y, { width: COLUMNS.discount.w });
    doc.text(money(item.taxAmount), COLUMNS.tax.x, y, { width: COLUMNS.tax.w });
    doc.text(money(item.total), COLUMNS.total.x, y, { width: COLUMNS.total.w, align: 'right' });
    doc.y = y + Math.max(12, doc.heightOfString(name, { width: COLUMNS.product.w }));
  }

  private renderTotals(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    this.ensureSpace(doc, 130);
    const labelX = 380;
    const valueX = 480;
    const width = 95;
    let y = doc.y;

    doc.font('Helvetica').fontSize(9).fillColor('#333333');
    const row = (label: string, value: string, bold = false) => {
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.text(label, labelX, y, { width: 90 });
      doc.text(value, valueX, y, { width, align: 'right' });
      y += 14;
    };

    row('Subtotal', money(data.totals.subtotal));
    if (data.totals.discount > 0) row(data.totals.couponCode ? `Discount (${data.totals.couponCode})` : 'Discount', `- ${money(data.totals.discount)}`);
    if (data.taxBreakdown.taxType === 'INTRA_STATE') {
      row('CGST', money(data.taxBreakdown.cgst ?? 0));
      row('SGST', money(data.taxBreakdown.sgst ?? 0));
    } else if (data.taxBreakdown.taxType === 'INTER_STATE') {
      row('IGST', money(data.taxBreakdown.igst ?? 0));
    } else {
      row('Tax', money(data.taxBreakdown.totalTax));
    }
    row('Shipping', data.totals.shippingCost === 0 ? 'FREE' : money(data.totals.shippingCost));
    doc.moveTo(labelX, y).lineTo(575, y).strokeColor('#CCCCCC').stroke();
    y += 6;
    row('Grand Total', money(data.totals.total), true);
    if (data.totals.refundedAmount > 0) row('Refunded', money(data.totals.refundedAmount));

    doc.y = y + 10;
  }

  private renderPaymentAndShipment(doc: PDFKit.PDFDocument, data: InvoiceData): void {
    this.ensureSpace(doc, 90);
    const top = doc.y;

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Payment', PAGE_MARGIN, top);
    doc.font('Helvetica').fontSize(9).fillColor('#333333');
    let y = top + 14;
    if (data.payment) {
      doc.text(`Status: ${data.payment.status}`, PAGE_MARGIN, y); y += 12;
      doc.text(`Gateway: ${data.payment.gatewayCode}`, PAGE_MARGIN, y); y += 12;
      if (data.payment.transactionId) { doc.text(`Transaction ID: ${data.payment.transactionId}`, PAGE_MARGIN, y, { width: 250 }); y += 12; }
      if (data.payment.paidAt) { doc.text(`Paid: ${formatDate(data.payment.paidAt)}`, PAGE_MARGIN, y); y += 12; }
    } else {
      doc.text('No payment recorded', PAGE_MARGIN, y); y += 12;
    }

    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Shipment', 300, top);
    doc.font('Helvetica').fontSize(9).fillColor('#333333');
    let y2 = top + 14;
    if (data.shipment) {
      doc.text(`Tracking #: ${data.shipment.trackingNumber ?? 'Not available'}`, 300, y2, { width: 255 }); y2 += 12;
      doc.text(`Carrier: ${data.shipment.carrier ?? 'Not available'}`, 300, y2); y2 += 12;
      doc.text(`Delivered: ${data.shipment.deliveredAt ? formatDate(data.shipment.deliveredAt) : 'Not yet delivered'}`, 300, y2); y2 += 12;
    } else {
      doc.text('Not shipped yet', 300, y2); y2 += 12;
    }

    doc.y = Math.max(y, y2) + 10;
  }

  private async renderQrCode(doc: PDFKit.PDFDocument, data: InvoiceData): Promise<void> {
    this.ensureSpace(doc, 90);
    const qrText = `${data.seller.storeName} | Invoice ${data.invoiceNumber} | Order ${data.order.orderNumber} | Total INR ${data.totals.total.toFixed(2)}`;
    try {
      const qrBuffer = await QRCode.toBuffer(qrText, { type: 'png', width: 80, margin: 1 });
      doc.image(qrBuffer, PAGE_MARGIN, doc.y, { width: 70, height: 70 });
    } catch {
      // QR generation should never block invoice delivery.
    }
    doc.y += 78;
  }

  private renderFooter(doc: PDFKit.PDFDocument): void {
    const range = doc.bufferedPageRange();
    // Computed from the page's own height/margins rather than hardcoded
    // coordinates — a fixed y too close to (or past) the bottom margin
    // silently triggers pdfkit's own overflow pagination, splitting the
    // footer onto extra blank pages instead of drawing it on the current one.
    const bottomY = doc.page.height - doc.page.margins.bottom - 24;
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.font('Helvetica').fontSize(7).fillColor('#999999')
        .text('This is a computer-generated invoice and does not require a signature.', PAGE_MARGIN, bottomY, { width: 515, align: 'center', lineBreak: false })
        .text(`Page ${i + 1} of ${range.count}`, PAGE_MARGIN, bottomY + 10, { width: 515, align: 'center', lineBreak: false });
    }
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
    if (doc.y + needed > 780) {
      doc.addPage();
      doc.y = PAGE_MARGIN;
    }
  }
}

function resolveLocalLogoPath(logo: string | null): string | null {
  if (!logo) return null;
  // Only ever reads from the platform's own known uploads directory — never
  // fetches an arbitrary URL, so a store's `logo` field can't be used to make
  // the server issue requests to attacker-chosen hosts (no SSRF surface).
  const match = /^\/?uploads\/(.+)$/i.exec(logo);
  if (!match) return null;
  if (!/\.(png|jpe?g)$/i.test(match[1])) return null;
  const filePath = path.join(process.cwd(), 'uploads', match[1]);
  return fs.existsSync(filePath) ? filePath : null;
}

function money(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
