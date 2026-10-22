const $ = id => document.getElementById(id);

const DB_KEY = "novabank_demo_v1";
const LOGIN_USER = "Taruhsi";
const LOGIN_PASS = "taru123";

let db = loadDB();
let chart = null;
let toastTimer;

function loadDB() {
  try {
    const data = JSON.parse(localStorage.getItem(DB_KEY));
    if (data && Array.isArray(data.customers) && Array.isArray(data.transactions)) return data;
  } catch (e) {}
  return { customers: [], transactions: [], nextAccount: 10001, nextTransaction: 1 };
}

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function money(value) {
  return "₹" + Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function showToast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3000);
}

function dateText(date) {
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function totalBalance() {
  return db.customers.reduce((sum, customer) => sum + Number(customer.balance), 0);
}

function transactionTotals() {
  return db.transactions.reduce((totals, tx) => {
    if (tx.type === "Deposit") totals.deposits += Number(tx.amount);
    if (tx.type === "Withdrawal") totals.withdrawals += Number(tx.amount);
    return totals;
  }, { deposits: 0, withdrawals: 0 });
}

/* LOGIN */
$("loginForm").addEventListener("submit", event => {
  event.preventDefault();

  const username = $("username").value.trim();
  const password = $("password").value;

  if (username === LOGIN_USER && password === LOGIN_PASS) {
    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("loginError").textContent = "";
    renderAll();
    showToast("Welcome to NovaBank!");
  } else {
    $("loginError").textContent = "Invalid username or password.";
  }
});

$("logoutBtn").addEventListener("click", () => {
  $("app").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
  $("password").value = "";
  showToast("You have logged out.");
});

/* NAVIGATION */
const pageTitles = {
  dashboard: "Dashboard Overview",
  customers: "Customer Management",
  transactions: "Transaction History",
  addCustomer: "Open New Account",
  money: "Deposit & Withdrawal"
};

function goToPage(page) {
  if (!pageTitles[page]) return;

  document.querySelectorAll(".page").forEach(section => section.classList.add("hidden"));
  $(page + "Page").classList.remove("hidden");

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("pageTitle").textContent = pageTitles[page];

  if (page === "dashboard") renderDashboard();
  if (page === "customers") renderCustomers();
  if (page === "transactions") renderTransactions();
  if (page === "money") renderAccountOptions();
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => goToPage(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => goToPage(button.dataset.go));
});

/* CUSTOMER ACCOUNTS */
$("customerForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("customerName").value.trim();
  const email = $("customerEmail").value.trim();
  const phone = $("customerPhone").value.trim();
  const type = $("accountType").value;
  const openingBalance = Number($("openingBalance").value);

  if (!name || !/^[0-9]{10}$/.test(phone)) {
    showToast("Enter a name and valid 10-digit phone number.");
    return;
  }

  if (!Number.isFinite(openingBalance) || openingBalance < 0 || openingBalance > 100000000) {
    showToast("Enter a valid opening balance.");
    return;
  }

  const account = {
    id: "NB" + db.nextAccount++,
    name,
    email,
    phone,
    type,
    balance: Math.round(openingBalance * 100) / 100,
    createdAt: new Date().toISOString()
  };

  db.customers.push(account);

  if (openingBalance > 0) {
    db.transactions.unshift({
      id: "TXN" + String(db.nextTransaction++).padStart(5, "0"),
      accountId: account.id,
      customer: account.name,
      type: "Deposit",
      amount: account.balance,
      note: "Opening balance",
      date: new Date().toISOString()
    });
  }

  saveDB();
  $("customerForm").reset();
  $("openingBalance").value = "0";
  renderAll();
  goToPage("customers");
  showToast("Account created: " + account.id);
});

/* DEPOSIT AND WITHDRAWAL */
$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();

  const accountId = $("transactionAccount").value;
  const type = $("transactionType").value;
  const amount = Number($("transactionAmount").value);
  const note = $("transactionNote").value.trim();

  const account = db.customers.find(customer => customer.id === accountId);

  if (!account) {
    showToast("Please select a customer account.");
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    showToast("Enter a valid transaction amount.");
    return;
  }

  if (type === "Withdrawal" && amount > account.balance) {
    showToast("Insufficient balance!");
    return;
  }

  const roundedAmount = Math.round(amount * 100) / 100;

  if (type === "Deposit") account.balance += roundedAmount;
  else account.balance -= roundedAmount;

  account.balance = Math.round(account.balance * 100) / 100;

  db.transactions.unshift({
    id: "TXN" + String(db.nextTransaction++).padStart(5, "0"),
    accountId: account.id,
    customer: account.name,
    type,
    amount: roundedAmount,
    note: note || type,
    date: new Date().toISOString()
  });

  saveDB();
  $("transactionForm").reset();
  renderAll();
  goToPage("transactions");
  showToast(type + " successful: " + money(roundedAmount));
});

/* RENDER DASHBOARD */
function renderDashboard() {
  const totals = transactionTotals();

  $("totalBalance").textContent = money(totalBalance());
  $("totalCustomers").textContent = db.customers.length;
  $("totalDeposits").textContent = money(totals.deposits);
  $("totalWithdrawals").textContent = money(totals.withdrawals);
  $("moneyTotalBalance").textContent = money(totalBalance());
  $("moneyAccountCount").textContent =
    db.customers.length + (db.customers.length === 1 ? " registered account" : " registered accounts");

  renderRecentTransactions();
  renderChart();
}

function renderRecentTransactions() {
  const recent = db.transactions.slice(0, 6);

  $("recentTransactions").innerHTML = recent.length ? recent.map(tx => `
    <tr>
      <td><strong>${escapeHTML(tx.id)}</strong></td>
      <td>${escapeHTML(tx.customer)}</td>
      <td>${escapeHTML(tx.accountId)}</td>
      <td>${escapeHTML(dateText(tx.date))}</td>
      <td class="${tx.type === "Deposit" ? "amount-positive" : "amount-negative"}">
        ${tx.type === "Deposit" ? "+" : "−"}${money(tx.amount)}
      </td>
      <td><span class="status">Completed</span></td>
    </tr>
  `).join("") : `<tr><td colspan="6" class="empty-state">No transactions yet. Create an account to get started.</td></tr>`;
}

/* CHART */
function renderChart() {
  const canvas = $("activityChart");
  if (!canvas || typeof Chart === "undefined") return;

  const deposits = transactionTotals().deposits;
  const withdrawals = transactionTotals().withdrawals;

  if (chart) chart.destroy();

  chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["Deposits", "Withdrawals"],
      datasets: [{
        label: "Amount (₹)",
        data: [deposits, withdrawals],
        backgroundColor: ["#6478f6", "#a17af4"],
        borderRadius: 8,
        maxBarThickness: 65
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => money(context.raw)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => "₹" + Number(value).toLocaleString("en-IN")
          },
          grid: { color: "#eef0f6" }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

/* CUSTOMER LIST */
function renderCustomers(search = "") {
  const query = search.toLowerCase();

  const customers = db.customers.filter(customer =>
    [customer.name, customer.id, customer.email, customer.phone, customer.type]
      .some(value => String(value || "").toLowerCase().includes(query))
  );

  $("customersTable").innerHTML = customers.length ? customers.map(customer => `
    <tr>
      <td><strong>${escapeHTML(customer.id)}</strong></td>
      <td>${escapeHTML(customer.name)}<br><small>${escapeHTML(customer.type)} Account</small></td>
      <td>${escapeHTML(customer.email || "—")}</td>
      <td>${escapeHTML(customer.phone)}</td>
      <td><strong>${money(customer.balance)}</strong></td>
      <td><button class="small-btn" data-deposit="${escapeHTML(customer.id)}">Transact</button></td>
    </tr>
  `).join("") : `<tr><td colspan="6" class="empty-state">No matching customers found.</td></tr>`;

  $("customersTable").querySelectorAll("[data-deposit]").forEach(button => {
    button.addEventListener("click", () => {
      goToPage("money");
      $("transactionAccount").value = button.dataset.deposit;
    });
  });
}

$("customerSearch").addEventListener("input", event => {
  renderCustomers(event.target.value);
});

/* TRANSACTION HISTORY */
function renderTransactions(search = "") {
  const query = search.toLowerCase();

  const transactions = db.transactions.filter(tx =>
    [tx.id, tx.customer, tx.accountId, tx.type, tx.note]
      .some(value => String(value || "").toLowerCase().includes(query))
  );

  $("transactionsTable").innerHTML = transactions.length ? transactions.map(tx => `
    <tr>
      <td><strong>${escapeHTML(tx.id)}</strong></td>
      <td>${escapeHTML(tx.customer)}</td>
      <td>${escapeHTML(tx.accountId)}</td>
      <td class="${tx.type === "Deposit" ? "type-deposit" : "type-withdrawal"}">${escapeHTML(tx.type)}</td>
      <td>${escapeHTML(dateText(tx.date))}</td>
      <td class="${tx.type === "Deposit" ? "amount-positive" : "amount-negative"}">
        ${tx.type === "Deposit" ? "+" : "−"}${money(tx.amount)}
      </td>
      <td><span class="status">Completed</span></td>
    </tr>
  `).join("") : `<tr><td colspan="7" class="empty-state">No matching transactions found.</td></tr>`;
}

$("transactionSearch").addEventListener("input", event => {
  renderTransactions(event.target.value);
});

/* ACCOUNT DROPDOWN */
function renderAccountOptions() {
  const select = $("transactionAccount");
  const previous = select.value;

  select.innerHTML = `<option value="">Choose an account</option>` +
    db.customers.map(customer =>
      `<option value="${escapeHTML(customer.id)}">${escapeHTML(customer.name)} — ${escapeHTML(customer.id)} (${money(customer.balance)})</option>`
    ).join("");

  if (db.customers.some(customer => customer.id === previous)) {
    select.value = previous;
  }
}

/* EXPORT CSV */
$("exportBtn").addEventListener("click", () => {
  if (!db.transactions.length) {
    showToast("There are no transactions to export.");
    return;
  }

  const headers = ["Transaction ID", "Customer", "Account", "Type", "Amount", "Description", "Date"];
  const rows = db.transactions.map(tx => [
    tx.id, tx.customer, tx.accountId, tx.type,
    tx.amount, tx.note, dateText(tx.date)
  ]);

  const csv = [headers, ...rows].map(row =>
    row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "NovaBank-Transactions.csv";
  link.click();
  URL.revokeObjectURL(url);

  showToast("Transaction CSV exported.");
});

/* INITIAL RENDER */
function renderAll() {
  renderDashboard();
  renderCustomers($("customerSearch").value);
  renderTransactions($("transactionSearch").value);
  renderAccountOptions();
}

renderAll();
