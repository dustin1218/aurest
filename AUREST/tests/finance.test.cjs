const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert");
for (const f of fs.readdirSync("js").filter((f) => f.endsWith(".js")))
  new vm.Script(fs.readFileSync("js/" + f, "utf8"), { filename: f });
console.log("PASS: all JavaScript parses");
const data = new Map();
const context = {
  console,
  crypto: require("crypto").webcrypto,
  Date,
  localStorage: { setItem: (k, v) => data.set(k, v) },
  store: { get: (k, d = null) => (data.has(k) ? JSON.parse(data.get(k)) : d) },
  getAllRooms: () => [{ id: "r", price: 1000 }],
  nightsBetween: (a, z) => (new Date(z) - new Date(a)) / 864e5,
  peso: (n) => "P" + n,
  addDays: () => new Date().toISOString().slice(0, 10),
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/finance.js", "utf8"), context);
vm.runInContext(
  `
const b={id:'test',roomId:'r',checkin:'2099-12-18',checkout:'2099-12-20',total:2000,status:'Pending'};
addTransaction({bookingId:'test',kind:'Payment',amount:600,status:'Submitted',reference:'x'});
if(moneyFor(b).paid!==0)throw Error('Unverified transfer counted');
let ts=transactions();ts[0].status='Verified';persist('aurest-transactions',ts);
if(moneyFor(b).paid!==600||moneyFor(b).balance!==1400)throw Error('Deposit balance');
if(cancellationQuote(b).refund!==600)throw Error('Early refund');
const late={...b,checkin:'2000-01-01'};if(cancellationQuote(late).fee!==600||cancellationQuote(late).refund!==0)throw Error('Late fee');
addTransaction({bookingId:'test',kind:'Payment',amount:1400,status:'Verified',reference:'y'});
if(cancellationQuote(late).refund!==1400)throw Error('Late full payment refund');
cancelReservation(b);if(moneyFor({...b,status:'Cancelled',cancellationFee:0}).pending!==2000)throw Error('Refund queue');
if(cancellationQuote(b).refund!==0)throw Error('Duplicate refund');
ts=transactions();ts.filter(t=>t.kind==='Refund').forEach(t=>t.status='Completed');persist('aurest-transactions',ts);
if(moneyFor(b).net!==0)throw Error('Refund ledger');
`,
  context,
);
console.log(
  "PASS: unverified payments, deposit balances, early/late cancellations, refund queue, duplicate refunds, completed refunds",
);
