// The only place the game asks for real money.
// Today a stand-in sheet confirms the purchase so the flow can be tested; nothing is charged.
// For the store build, buy() becomes the RevenueCat / store purchase call (same as the other games).
import { t } from './i18n.js';

// Prices are placeholders; the stores set the real local prices.
export const PRODUCTS = {
  no_ads: { price: '$2.99', kind: 'forever', icon: '🚫' },
  starter: { price: '$1.99', kind: 'once', coins: 1500, hints: 10, skin: 'golden', icon: '🎁' },
  hints_20: { price: '$1.99', kind: 'consumable', hints: 20, icon: '💡' },
  coins_s: { price: '$0.99', kind: 'consumable', coins: 1000, icon: '🪙' },
  coins_m: { price: '$4.99', kind: 'consumable', coins: 6000, icon: '💰' },
};

export function createPayments() {
  const screen = document.getElementById('screen-pay');
  function buy(id) {
    return new Promise((resolve) => {
      document.getElementById('pay-title').textContent = t(`iap.${id}`);
      document.getElementById('pay-price').textContent = PRODUCTS[id].price;
      screen.hidden = false;
      const ok = document.getElementById('pay-confirm');
      const no = document.getElementById('pay-cancel');
      const done = (r) => { screen.hidden = true; ok.onclick = no.onclick = null; resolve(r); };
      ok.onclick = () => done(true);
      no.onclick = () => done(false);
    });
  }
  return { buy };
}
