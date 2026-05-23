import type { Order } from './api'

// Opens a print-ready receipt for a convenience-store order in a new window.
export function printOrderReceipt(order: Order, businessName?: string) {
  const fmtR = (n: number) =>
    'J$' + n.toLocaleString('en-JM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const date = new Date(order.created_at).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
  const items = order.items ?? []
  const itemRows = items.map((it) => `
    <tr>
      <td style="padding:3px 0">${it.name}${it.sku ? ` <span style="color:#888;font-size:10px">${it.sku}</span>` : ''}${it.refunded ? ` <span style="color:#c0392b;font-size:10px">(refunded)</span>` : ''}</td>
      <td style="text-align:center;padding:3px 6px">${it.quantity}</td>
      <td style="text-align:right;padding:3px 0">${fmtR(it.unit_price)}</td>
      <td style="text-align:right;padding:3px 0">${fmtR(it.total)}</td>
    </tr>`).join('')

  const win = window.open('', '_blank', 'width=420,height=680')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;font-size:12px;width:320px;padding:20px;color:#111}
      .c{text-align:center} .b{font-weight:bold}
      hr{border:none;border-top:1px dashed #aaa;margin:10px 0}
      table{width:100%;border-collapse:collapse}
      th{text-align:left;padding:3px 0;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888}
      .row{display:flex;justify-content:space-between;padding:2px 0}
      .total{display:flex;justify-content:space-between;padding:5px 0;font-weight:bold;font-size:14px}
      @media print{body{width:100%}}
    </style></head><body>
    <div class="c b" style="font-size:15px;margin-bottom:3px">${businessName ?? 'Convenience Store'}</div>
    <div class="c" style="font-size:11px;color:#666;margin-bottom:12px">${date}</div>
    <hr/>
    <div class="row"><span class="b">${order.invoice_no ?? '#' + order.order_no}</span><span style="color:#666">Cashier: ${order.cashier_name}</span></div>
    ${order.customer_name ? `<div class="row" style="color:#666"><span>Customer: ${order.customer_name}</span></div>` : ''}
    <hr/>
    <table>
      <thead><tr>
        <th>Item</th><th style="text-align:center">Qty</th>
        <th style="text-align:right">Price</th><th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr/>
    <div class="row"><span>Subtotal</span><span>${fmtR(order.subtotal)}</span></div>
    <div class="row"><span>Tax (15%)</span><span>${fmtR(order.tax)}</span></div>
    ${order.discount > 0 ? `<div class="row"><span>Discount</span><span>-${fmtR(order.discount)}</span></div>` : ''}
    <hr/>
    <div class="total"><span>TOTAL</span><span>${fmtR(order.total)}</span></div>
    <hr/>
    <div class="row"><span>Payment</span><span>${order.payment_method ?? '--'}</span></div>
    ${order.change_given != null && order.change_given > 0 ? `<div class="row"><span>Change</span><span>${fmtR(order.change_given)}</span></div>` : ''}
    <hr/>
    <div class="c" style="margin-top:14px;font-size:11px;color:#666">Thank you for your purchase!</div>
  </body></html>`)
  win.document.close()
  win.focus()
  win.print()
}
