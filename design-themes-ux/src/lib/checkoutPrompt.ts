/**
 * checkoutPrompt.ts — remembers that a guest has already seen the optional
 * "create an account" prompt for the current checkout attempt, so clicking
 * through to checkout again goes straight there instead of re-prompting.
 *
 * sessionStorage (not localStorage): a new tab or a later visit is a new
 * attempt. Cleared once an order is placed. Storage can be unavailable
 * (private mode, blocked site data) — then the prompt simply shows again,
 * which is harmless.
 */

const KEY = 'aurus_checkout_prompt_seen';

export function hasSeenCheckoutPrompt(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markCheckoutPromptSeen(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // storage unavailable — see file comment
  }
}

export function resetCheckoutPrompt(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // storage unavailable — see file comment
  }
}
