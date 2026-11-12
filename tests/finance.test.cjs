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

// Room types with several rooms: count free rooms on the busiest night of the stay.
context.getAllRooms = () => [{ id: "r", price: 1000, units: 3 }];
context.allBookings = () => [
  { id: "a", roomId: "r", checkin: "2099-01-01", checkout: "2099-01-04", rooms: 2, status: "Pending" },
  { id: "c", roomId: "r", checkin: "2099-01-02", checkout: "2099-01-03", rooms: 1, status: "Cancelled" },
  { id: "d", roomId: "r", checkin: "2099-01-03", checkout: "2099-01-05", status: "Confirmed" },
];
vm.runInContext(
  `
if(roomsFree('r','2099-01-01','2099-01-02')!==1)throw Error('One booking holding 2 of 3 rooms');
if(roomsFree('r','2099-01-01','2099-01-05')!==0)throw Error('Busiest night decides');
if(roomsFree('r','2099-01-04','2099-01-06')!==2)throw Error('Check-out day is free');
if(roomsFree('r','2099-01-01','2099-01-05','a')!==2)throw Error('Excluded booking (rescheduling)');
if(!available('r','2099-01-01','2099-01-02',undefined,1)||available('r','2099-01-01','2099-01-02',undefined,2))throw Error('Requested quantity');
if(bookingTotal({roomId:'r',checkin:'2099-01-01',checkout:'2099-01-03',rooms:2})!==4000)throw Error('Multi-room total');
`,
  context,
);
console.log("PASS: free rooms per type, cancelled stays ignored, check-out day, multi-room totals");
