const sendMail = jest.fn();
const createTransport = jest.fn((..._args: unknown[]) => ({ sendMail }));
jest.mock('nodemailer', () => ({ createTransport: (...a: unknown[]) => createTransport(...a) }));

import { EmailService, maskEmail } from './email.service';

const config = (env: Record<string, string>) => ({ get: jest.fn((k: string) => env[k]) }) as any;
const SMTP = { SMTP_HOST: 'smtp.example', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'Aurus <orders@aurus.example>' };
const MSG = { to: 'asha@example.com', subject: 's', html: '<p>h</p>', text: 't' };

describe('EmailService', () => {
  beforeEach(() => { sendMail.mockReset(); createTransport.mockClear(); });

  it('sends nothing and says so when SMTP is not configured', async () => {
    const svc = new EmailService(config({}));
    jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);

    expect(await svc.send(MSG)).toEqual({ status: 'not_configured' });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('reports accepted only when the SMTP server accepted every recipient', async () => {
    sendMail.mockResolvedValue({ accepted: ['asha@example.com'], rejected: [], messageId: '<id@x>' });
    const svc = new EmailService(config(SMTP));

    expect(await svc.send(MSG)).toEqual({ status: 'accepted', messageId: '<id@x>' });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: SMTP.SMTP_FROM, to: MSG.to }));
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'smtp.example', port: 587, secure: false }));
  });

  it('treats a rejected recipient as rejected, not sent', async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: ['asha@example.com'], response: '550 no such user' });
    const svc = new EmailService(config(SMTP));

    expect(await svc.send(MSG)).toEqual({ status: 'rejected', reason: '550 no such user' });
  });

  it('lets transport errors propagate so the caller can retry', async () => {
    sendMail.mockRejectedValue(new Error('ECONNREFUSED'));
    const svc = new EmailService(config(SMTP));

    await expect(svc.send(MSG)).rejects.toThrow('ECONNREFUSED');
  });

  it('uses implicit TLS on port 465', async () => {
    sendMail.mockResolvedValue({ accepted: ['a'], rejected: [], messageId: 'x' });
    await new EmailService(config({ ...SMTP, SMTP_PORT: '465' })).send(MSG);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true }));
  });

  it('masks addresses for logs', () => {
    expect(maskEmail('asha@example.com')).toBe('a***@example.com');
    expect(maskEmail('broken')).toBe('***');
  });
});
