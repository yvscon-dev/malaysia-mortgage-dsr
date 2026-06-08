import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  Calculator,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Home,
  Menu,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  WalletCards,
  X,
} from "lucide-react";

const STORAGE_KEY = "malaysia-dsr-customers";

const customerFields = [
  { key: "customerName", label: "Customer name", type: "text", placeholder: "e.g. Ahmad bin Rahman" },
  { key: "age", label: "Age", type: "number", placeholder: "e.g. 35" },
  { key: "propertyPrice", label: "Property price", currency: true },
  { key: "loanMargin", label: "Loan margin (%)", type: "number", placeholder: "e.g. 90", note: "Loan amount will be calculated automatically." },
  { key: "loanAmount", label: "Loan amount", currency: true, readOnly: true, note: "Property price x loan margin." },
  { key: "interestRate", label: "Interest rate (% p.a.)", type: "number", placeholder: "e.g. 4.20", note: "Annual reducing-balance interest rate." },
  { key: "loanTenure", label: "Loan tenure (years)", type: "number", placeholder: "e.g. 30", note: "Adjust according to the selected bank's age and tenure policy." },
  { key: "bankName", label: "Bank name", type: "text", placeholder: "e.g. Maybank" },
];

const incomeFields = [
  { key: "basicSalary", label: "Basic salary" },
  { key: "fixedAllowance", label: "Fixed allowance" },
  { key: "averageCommission", label: "Average commission" },
  { key: "averageBonus", label: "Average bonus" },
  { key: "overtime", label: "Overtime" },
  { key: "rentalIncome", label: "Rental income" },
  { key: "otherIncome", label: "Other income" },
];

const commitmentFields = [
  { key: "existingHousingLoan", label: "Existing housing loan" },
  { key: "carLoan", label: "Car loan" },
  { key: "personalLoan", label: "Personal loan" },
  { key: "creditCardOutstanding", label: "Credit card total outstanding", note: "5% will be counted as the monthly minimum payment." },
  { key: "ptptn", label: "PTPTN / education loan" },
  { key: "otherCommitment", label: "Other monthly commitment" },
];

const allFields = [...customerFields, ...incomeFields, ...commitmentFields];
const createEmptyForm = () => ({
  ...Object.fromEntries(allFields.map((field) => [field.key, ""])),
  incomeCurrency: "MYR",
  commitmentCurrency: "MYR",
  sgdRate: "3.30",
  loanMargin: "90",
});
const numberValue = (value) => Number(value) || 0;

const formatAmountInput = (value) => {
  if (value === "" || value === undefined || value === null) return "";
  const [whole, decimal] = String(value).replace(/,/g, "").split(".");
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal === undefined ? formattedWhole : `${formattedWhole}.${decimal}`;
};

const cleanAmountInput = (value) => {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimals] = cleaned.split(".");
  return decimals.length ? `${whole}.${decimals.join("")}` : whole;
};

const formatCurrency = (value, currency = "MYR") =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(numberValue(value));

const formatRM = (value) => formatCurrency(value, "MYR");

const formatDate = (date) =>
  new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

function getResults(form) {
  const sgdRate = numberValue(form.sgdRate) || 3.3;
  const incomeCurrency = form.incomeCurrency || "MYR";
  const commitmentCurrency = form.commitmentCurrency || "MYR";
  const incomeRate = incomeCurrency === "SGD" ? sgdRate : 1;
  const commitmentRate = commitmentCurrency === "SGD" ? sgdRate : 1;
  const originalIncome = incomeFields.reduce((total, field) => total + numberValue(form[field.key]), 0);
  const creditCardMinimumPaymentOriginal = numberValue(form.creditCardOutstanding) * 0.05;
  const loanAmount = numberValue(form.loanAmount);
  const monthlyInterestRate = numberValue(form.interestRate) / 100 / 12;
  const totalLoanMonths = numberValue(form.loanTenure) * 12;
  const newHousingInstallment =
    loanAmount > 0 && totalLoanMonths > 0
      ? monthlyInterestRate > 0
        ? (loanAmount * monthlyInterestRate * (1 + monthlyInterestRate) ** totalLoanMonths) /
          ((1 + monthlyInterestRate) ** totalLoanMonths - 1)
        : loanAmount / totalLoanMonths
      : 0;
  const originalCommitment = commitmentFields.reduce(
    (total, field) =>
      total + (field.key === "creditCardOutstanding" ? creditCardMinimumPaymentOriginal : numberValue(form[field.key])),
    0,
  );
  const totalIncome = originalIncome * incomeRate;
  const convertedExistingCommitment = originalCommitment * commitmentRate;
  const totalCommitment = convertedExistingCommitment + newHousingInstallment;
  const creditCardMinimumPayment = creditCardMinimumPaymentOriginal * commitmentRate;
  const dsr = totalIncome > 0 ? (totalCommitment / totalIncome) * 100 : 0;
  const status =
    totalIncome <= 0
      ? { label: "Awaiting income", tone: "neutral", note: "Add monthly income to calculate DSR." }
      : dsr < 60
        ? { label: "Healthy", tone: "healthy", note: "Comfortable commitment level for initial assessment." }
        : dsr <= 70
          ? { label: "Borderline", tone: "borderline", note: "Review affordability and bank-specific requirements." }
          : { label: "High Risk", tone: "risk", note: "Commitments may be too high for comfortable approval." };
  return {
    totalIncome,
    totalCommitment,
    originalIncome,
    originalCommitment,
    convertedExistingCommitment,
    newHousingInstallment,
    creditCardMinimumPayment,
    creditCardMinimumPaymentOriginal,
    incomeCurrency,
    commitmentCurrency,
    sgdRate,
    dsr,
    status,
  };
}

const toneClasses = {
  healthy: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-500",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
  },
  borderline: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    bar: "bg-amber-500",
    soft: "bg-amber-50",
    text: "text-amber-700",
  },
  risk: {
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    bar: "bg-rose-500",
    soft: "bg-rose-50",
    text: "text-rose-700",
  },
  neutral: {
    badge: "bg-slate-50 text-slate-600 border-slate-200",
    bar: "bg-slate-300",
    soft: "bg-slate-50",
    text: "text-slate-600",
  },
};

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500 text-white shadow-lg shadow-teal-950/20">
        <Home size={20} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.19em] text-teal-300">Malaysia Mortgage</p>
        <p className="text-sm font-semibold text-white">DSR Calculator</p>
      </div>
    </div>
  );
}

function Sidebar({ page, setPage, mobileOpen, setMobileOpen }) {
  const nav = [
    { id: "calculator", label: "Calculator", icon: Calculator },
    { id: "customers", label: "Customer Summary", icon: Users },
    { id: "report", label: "Result Report", icon: FileText },
  ];
  return (
    <>
      {mobileOpen && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`no-print fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-[#0f2742] px-5 py-6 text-white transition-transform lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-9 flex items-center justify-between">
          <Logo />
          <button className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
        <nav className="space-y-1.5">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setPage(item.id);
                  setMobileOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${page === item.id ? "bg-teal-500 text-white shadow-lg shadow-teal-950/20" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
              >
                <Icon size={18} />
                {item.label}
                {page === item.id && <ChevronRight className="ml-auto" size={16} />}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-teal-400/15 text-teal-300">
            <ShieldCheck size={19} />
          </div>
          <p className="text-sm font-semibold">Private by design</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Customer records stay on this device and are not sent to a server.</p>
        </div>
      </aside>
    </>
  );
}

function Header({ page, setMobileOpen, onInstall, isInstalled }) {
  const titles = {
    calculator: ["DSR Calculator", "Assess customer affordability with a live debt service ratio."],
    customers: ["Customer Summary", "Review and manage customer assessments saved on this device."],
    report: ["Result Report", "A clear assessment summary ready for discussion or export."],
  };
  return (
    <header className="no-print flex min-h-20 items-center border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8">
      <button className="mr-3 rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden" onClick={() => setMobileOpen(true)}>
        <Menu size={20} />
      </button>
      <div>
        <h1 className="text-lg font-bold text-[#0f2742] md:text-xl">{titles[page][0]}</h1>
        <p className="hidden text-sm text-slate-500 sm:block">{titles[page][1]}</p>
      </div>
      <button
        onClick={onInstall}
        disabled={isInstalled}
        className="ml-auto flex items-center gap-2 rounded-xl bg-teal-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-600 disabled:cursor-default disabled:bg-emerald-50 disabled:text-emerald-700"
      >
        {isInstalled ? <Check size={15} /> : <Download size={15} />}
        {isInstalled ? "App Installed" : "Install App"}
      </button>
      <div className="ml-3 hidden items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 md:flex">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Local workspace
      </div>
    </header>
  );
}

function InputField({ field, value, onChange, currency = "MYR" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{field.label}</span>
      <div className="relative">
        {field.currency && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{currency === "SGD" ? "S$" : "RM"}</span>}
        <input
          className={`field ${field.currency ? "currency-field number-field" : ""}`}
          type={field.currency ? "text" : field.type || "text"}
          min={field.currency ? "0" : undefined}
          step={field.currency ? "100" : undefined}
          inputMode={field.currency ? "decimal" : undefined}
          placeholder={field.currency ? "0.00" : field.placeholder}
          value={field.currency ? formatAmountInput(value) : value}
          onChange={(event) => onChange(field.key, field.currency ? cleanAmountInput(event.target.value) : event.target.value)}
          readOnly={field.readOnly}
        />
      </div>
      {field.note && <span className="mt-1.5 block text-[11px] leading-4 text-slate-400">{field.note}</span>}
    </label>
  );
}

function CurrencyToggle({ value, onChange }) {
  return (
    <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
      {["MYR", "SGD"].map((currency) => (
        <button
          key={currency}
          type="button"
          onClick={() => onChange(currency)}
          className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition ${value === currency ? "bg-[#0f2742] text-white shadow-sm" : "text-slate-500 hover:text-[#0f2742]"}`}
        >
          {currency}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children, total, currency, onCurrencyChange }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 md:px-6">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-600">
          <Icon size={19} />
        </div>
        <div>
          <h2 className="font-bold text-[#0f2742]">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {currency && <CurrencyToggle value={currency} onChange={onCurrencyChange} />}
        {total !== undefined && (
          <div className="ml-auto text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total monthly</p>
            <p className="text-sm font-bold text-[#0f2742]">{formatCurrency(total, currency || "MYR")}</p>
          </div>
        )}
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-6">{children}</div>
    </section>
  );
}

function ResultPanel({ results, onSave, onReport, saved }) {
  const tone = toneClasses[results.status.tone];
  const meter = Math.min(results.dsr, 100);
  return (
    <aside className="card sticky top-5 overflow-hidden">
      <div className="bg-[#0f2742] px-6 py-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-300">Live assessment</p>
            <h2 className="mt-1 text-lg font-bold">DSR Overview</h2>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
            <Calculator size={19} />
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className={`rounded-2xl ${tone.soft} p-5 text-center`}>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Debt Service Ratio</p>
          <p className={`mt-2 text-5xl font-black tracking-tight ${tone.text}`}>{results.dsr.toFixed(1)}%</p>
          <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tone.badge}`}>{results.status.label}</span>
          <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-slate-500">{results.status.note}</p>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Healthy</span><span>Borderline</span><span>High risk</span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full transition-all duration-300 ${tone.bar}`} style={{ width: `${meter}%` }} />
            <span className="absolute left-[60%] top-0 h-full w-px bg-white/90" />
            <span className="absolute left-[70%] top-0 h-full w-px bg-white/90" />
          </div>
        </div>
        <div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-100">
          <MetricRow label="Total monthly income" value={formatRM(results.totalIncome)} icon={Banknote} />
          <MetricRow label="Total commitments" value={formatRM(results.totalCommitment)} icon={WalletCards} />
          <MetricRow label="Available after commitments" value={formatRM(results.totalIncome - results.totalCommitment)} icon={ShieldCheck} />
        </div>
        <div className="mt-6 grid gap-2">
          <button onClick={onSave} className="flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-600">
            {saved ? <Check size={17} /> : <Save size={17} />} {saved ? "Customer saved" : "Save Customer"}
          </button>
          <button onClick={onReport} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-[#0f2742] transition hover:bg-slate-50">
            View Result Report <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function MetricRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="text-slate-400" size={16} />
      <span className="text-xs text-slate-500">{label}</span>
      <strong className="ml-auto text-sm text-[#0f2742]">{value}</strong>
    </div>
  );
}

function CalculatorPage({ form, setForm, results, onSave, onReport, onReset, saved }) {
  const onChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  return (
    <main className="mx-auto grid max-w-[1500px] gap-6 p-4 md:p-8 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-teal-600">New assessment</p>
            <p className="mt-1 text-xs text-slate-500">All calculations update automatically as you enter values.</p>
          </div>
          <button onClick={onReset} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
            <RefreshCw size={14} /> Reset
          </button>
        </div>
        <SectionCard icon={UserRound} title="Customer & Loan Information" subtitle="Customer profile and proposed mortgage terms">
          {customerFields.map((field) => <InputField key={field.key} field={field} value={form[field.key]} onChange={onChange} />)}
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 sm:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-[#0f2742]">Calculated new housing loan installment</p>
                <p className="mt-1 text-[11px] text-slate-500">Based on {formatRM(form.loanAmount)}, {numberValue(form.interestRate).toFixed(2)}% p.a. and {numberValue(form.loanTenure)} years</p>
              </div>
              <strong className="text-lg text-teal-700">{formatRM(results.newHousingInstallment)} / month</strong>
            </div>
          </div>
        </SectionCard>
        <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <p className="text-xs font-bold text-[#0f2742]">SGD conversion rate</p>
            <p className="mt-1 text-[11px] text-slate-500">Applied whenever income or commitments are entered in SGD.</p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            1 SGD =
            <span className="font-bold text-slate-400">RM</span>
            <input className="field number-field w-28" type="number" min="0" step="0.01" value={form.sgdRate} onChange={(event) => onChange("sgdRate", event.target.value)} />
          </label>
        </div>
        <SectionCard icon={Banknote} title="Monthly Income" subtitle="Enter gross average monthly income" total={results.originalIncome} currency={results.incomeCurrency} onCurrencyChange={(currency) => onChange("incomeCurrency", currency)}>
          {incomeFields.map((field) => <InputField key={field.key} field={{ ...field, currency: true }} value={form[field.key]} onChange={onChange} currency={results.incomeCurrency} />)}
          {results.incomeCurrency === "SGD" && <ConversionNote original={results.originalIncome} converted={results.totalIncome} currency="SGD" rate={results.sgdRate} />}
        </SectionCard>
        <SectionCard icon={WalletCards} title="Monthly Commitments" subtitle="Include all existing and proposed repayments" total={results.originalCommitment} currency={results.commitmentCurrency} onCurrencyChange={(currency) => onChange("commitmentCurrency", currency)}>
          {commitmentFields.map((field) => <InputField key={field.key} field={{ ...field, currency: true }} value={form[field.key]} onChange={onChange} currency={results.commitmentCurrency} />)}
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-4 sm:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[#0f2742]">Calculated credit card minimum payment</p>
                <p className="mt-1 text-[11px] text-slate-500">5% of {formatCurrency(form.creditCardOutstanding, results.commitmentCurrency)} total outstanding</p>
              </div>
              <strong className="text-sm text-teal-700">{formatCurrency(results.creditCardMinimumPaymentOriginal, results.commitmentCurrency)}</strong>
            </div>
          </div>
          {results.commitmentCurrency === "SGD" && <ConversionNote original={results.originalCommitment} converted={results.convertedExistingCommitment} currency="SGD" rate={results.sgdRate} />}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[#0f2742]">New housing loan installment</p>
                <p className="mt-1 text-[11px] text-slate-500">Automatically calculated from the loan terms above</p>
              </div>
              <strong className="text-sm text-[#0f2742]">{formatRM(results.newHousingInstallment)}</strong>
            </div>
          </div>
        </SectionCard>
      </div>
      <ResultPanel results={results} onSave={onSave} onReport={onReport} saved={saved} />
    </main>
  );
}

function ConversionNote({ original, converted, currency, rate }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 sm:col-span-2">
      <p className="text-xs font-bold text-[#0f2742]">Converted for DSR calculation</p>
      <p className="mt-1 text-[11px] text-slate-500">{formatCurrency(original, currency)} x RM {rate.toFixed(2)} = <strong className="text-blue-700">{formatRM(converted)}</strong></p>
    </div>
  );
}

function CustomersPage({ customers, onLoad, onDelete, startNew }) {
  const [search, setSearch] = useState("");
  const filtered = customers.filter((customer) => [customer.form.customerName, customer.form.age, customer.form.bankName].join(" ").toLowerCase().includes(search.toLowerCase()));
  return (
    <main className="mx-auto max-w-[1500px] p-4 md:p-8">
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
          <div>
            <h2 className="font-bold text-[#0f2742]">Saved customer assessments</h2>
            <p className="mt-1 text-xs text-slate-500">{customers.length} record{customers.length === 1 ? "" : "s"} stored on this device</p>
          </div>
          <button onClick={startNew} className="flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-600">
            <Plus size={17} /> New assessment
          </button>
        </div>
        <div className="p-5 md:p-6">
          <label className="relative block max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input className="field pl-10" placeholder="Search name, age or bank..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          {filtered.length ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((customer) => {
                const tone = toneClasses[customer.results.status.tone];
                return (
                  <article key={customer.id} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60">
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-[#0f2742]"><UserRound size={19} /></div>
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-[#0f2742]">{customer.form.customerName || "Unnamed customer"}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">{customer.form.age ? `Age ${customer.form.age}` : "Age not provided"}</p>
                      </div>
                      <span className={`ml-auto rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone.badge}`}>{customer.results.status.label}</span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <SmallStat label="DSR" value={`${customer.results.dsr.toFixed(1)}%`} />
                      <SmallStat label="Loan amount" value={formatRM(customer.form.loanAmount)} />
                    </div>
                    <div className="mt-4 space-y-2 text-xs text-slate-500">
                      <p className="flex items-center gap-2"><Building2 size={14} /> {customer.form.bankName || "Bank not specified"}</p>
                      <p className="flex items-center gap-2"><Home size={14} /> Installment {formatRM(customer.results.newHousingInstallment)}</p>
                      <p className="flex items-center gap-2"><ClipboardList size={14} /> Saved {formatDate(customer.savedAt)}</p>
                    </div>
                    <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
                      <button onClick={() => onLoad(customer, "report")} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f2742] px-3 py-2 text-xs font-bold text-white hover:bg-[#173a60]">View report <ChevronRight size={14} /></button>
                      <button aria-label="Delete customer" onClick={() => onDelete(customer.id)} className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-80 place-items-center text-center">
              <div>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Users size={24} /></div>
                <h3 className="mt-4 font-bold text-[#0f2742]">{customers.length ? "No matching customers" : "No saved customers yet"}</h3>
                <p className="mt-1 text-sm text-slate-500">{customers.length ? "Try a different search term." : "Completed assessments will appear here."}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function SmallStat({ label, value }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-bold text-[#0f2742]">{value}</p></div>;
}

function ReportPage({ form, results, onBack }) {
  const tone = toneClasses[results.status.tone];
  const detailRows = [
    ["Customer name", form.customerName || "Not provided"],
    ["Age", form.age ? `${form.age} years old` : "Not provided"],
    ["Bank name", form.bankName || "Not specified"],
    ["Property price", formatRM(form.propertyPrice)],
    ["Loan margin", `${numberValue(form.loanMargin).toFixed(2)}%`],
    ["Loan amount", formatRM(form.loanAmount)],
    ["Interest rate", `${numberValue(form.interestRate).toFixed(2)}% p.a.`],
    ["Loan tenure", `${numberValue(form.loanTenure)} years`],
    ["New housing installment", formatRM(results.newHousingInstallment)],
  ];
  return (
    <main className="report-wrap mx-auto max-w-5xl p-4 md:p-8">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <button onClick={onBack} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><ArrowLeft size={15} /> Back to calculator</button>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/20 hover:bg-teal-600"><Download size={17} /> Export to PDF</button>
      </div>
      <article className="card overflow-hidden">
        <div className="flex flex-col gap-6 bg-[#0f2742] p-6 text-white sm:flex-row sm:items-center sm:justify-between md:p-9">
          <Logo />
          <div className="sm:text-right">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-300">Assessment Report</p>
            <p className="mt-1 text-xs text-slate-300">Prepared {formatDate(new Date())}</p>
          </div>
        </div>
        <div className="p-6 md:p-9">
          <div className={`grid gap-6 rounded-2xl ${tone.soft} p-6 sm:grid-cols-[1fr_auto] sm:items-center`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Overall assessment</p>
              <h2 className="mt-2 text-2xl font-black text-[#0f2742]">{form.customerName || "Customer"} - {results.status.label}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{results.status.note} This indicative result should be considered alongside each bank's current credit policies.</p>
            </div>
            <div className="rounded-2xl bg-white px-7 py-5 text-center shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Calculated DSR</p>
              <p className={`mt-1 text-4xl font-black ${tone.text}`}>{results.dsr.toFixed(1)}%</p>
            </div>
          </div>
          <ReportSection title="Customer & Financing Details">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {detailRows.map(([label, value]) => <ReportItem key={label} label={label} value={value} />)}
            </div>
          </ReportSection>
          <div className="grid gap-6 md:grid-cols-2">
            <ReportSection title={`Monthly Income (${results.incomeCurrency})`}>
              <BreakdownRows fields={incomeFields} form={form} currency={results.incomeCurrency} />
              {results.incomeCurrency === "SGD" && <p className="mt-3 text-[10px] text-slate-400">Converted at 1 SGD = RM {results.sgdRate.toFixed(2)}</p>}
              <TotalLine label="Total income used for DSR (MYR)" value={results.totalIncome} />
            </ReportSection>
            <ReportSection title={`Monthly Commitments (${results.commitmentCurrency})`}>
              <BreakdownRows fields={commitmentFields} form={form} currency={results.commitmentCurrency} />
              {results.commitmentCurrency === "SGD" && <p className="mt-3 text-[10px] text-slate-400">Converted at 1 SGD = RM {results.sgdRate.toFixed(2)}</p>}
              <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-100 pt-3 text-xs"><span className="text-slate-500">New housing loan installment (MYR)</span><strong className="text-[#0f2742]">{formatRM(results.newHousingInstallment)}</strong></div>
              <TotalLine label="Total commitments used for DSR (MYR)" value={results.totalCommitment} />
            </ReportSection>
          </div>
          <ReportSection title="Calculation Summary">
            <div className="grid gap-4 sm:grid-cols-3">
              <SmallStat label="Total income" value={formatRM(results.totalIncome)} />
              <SmallStat label="Total commitments" value={formatRM(results.totalCommitment)} />
              <SmallStat label="Available balance" value={formatRM(results.totalIncome - results.totalCommitment)} />
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-600">
              DSR = {formatRM(results.totalCommitment)} / {formatRM(results.totalIncome)} x 100 = <strong className={tone.text}>{results.dsr.toFixed(1)}%</strong>
            </div>
          </ReportSection>
          <p className="mt-8 border-t border-slate-100 pt-5 text-[10px] leading-5 text-slate-400">Disclaimer: This report is an indicative affordability assessment only and does not constitute loan approval or financial advice. Final eligibility is subject to the selected bank's credit assessment and prevailing policies.</p>
        </div>
      </article>
    </main>
  );
}

function ReportSection({ title, children }) {
  return <section className="mt-7 rounded-2xl border border-slate-200 p-5 md:p-6"><h3 className="mb-5 text-sm font-bold text-[#0f2742]">{title}</h3>{children}</section>;
}

function ReportItem({ label, value }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-[#0f2742]">{value}</p></div>;
}

function BreakdownRows({ fields, form, currency = "MYR" }) {
  return <div className="space-y-2.5">{fields.map((field) => <div key={field.key} className="flex items-center justify-between gap-4 text-xs"><span className="text-slate-500">{field.key === "creditCardOutstanding" ? "Credit card minimum payment (5%)" : field.label}</span><strong className="text-[#0f2742]">{formatCurrency(field.key === "creditCardOutstanding" ? numberValue(form[field.key]) * 0.05 : form[field.key], currency)}</strong></div>)}</div>;
}

function TotalLine({ label, value }) {
  return <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-sm"><strong className="text-[#0f2742]">{label}</strong><strong className="text-teal-600">{formatRM(value)}</strong></div>;
}

export default function App() {
  const [page, setPage] = useState("calculator");
  const [form, setForm] = useState(createEmptyForm);
  const [customers, setCustomers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  const results = useMemo(() => getResults(form), [form]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    setSaved(false);
  }, [form]);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    const calculatedLoanAmount = numberValue(form.propertyPrice) * (numberValue(form.loanMargin) / 100);
    const nextLoanAmount = calculatedLoanAmount ? calculatedLoanAmount.toFixed(2) : "";
    if (form.loanAmount !== nextLoanAmount) {
      setForm((current) => ({ ...current, loanAmount: nextLoanAmount }));
    }
  }, [form.propertyPrice, form.loanMargin, form.loanAmount]);

  const saveCustomer = () => {
    const id = crypto.randomUUID();
    setCustomers((current) => [{ id, form, results, savedAt: new Date().toISOString() }, ...current]);
    setSaved(true);
  };

  const loadCustomer = (customer, destination = "calculator") => {
    const loadedForm = { ...createEmptyForm(), ...customer.form };
    if (!customer.form.loanMargin && numberValue(customer.form.propertyPrice) > 0) {
      loadedForm.loanMargin = ((numberValue(customer.form.loanAmount) / numberValue(customer.form.propertyPrice)) * 100).toFixed(2);
    }
    setForm(loadedForm);
    setPage(destination);
  };

  const startNew = () => {
    setForm(createEmptyForm());
    setPage("calculator");
  };

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
      return;
    }
    const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    window.alert(
      isIOS
        ? "iPhone / iPad install: open this website in Safari, tap Share, then choose Add to Home Screen."
        : "Install: open your browser menu, then choose Install App or Add to Home Screen.",
    );
  };

  return (
    <div className="shell-bg min-h-screen">
      <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="min-h-screen lg:pl-72">
        <Header page={page} setMobileOpen={setMobileOpen} onInstall={installApp} isInstalled={isInstalled} />
        {page === "calculator" && <CalculatorPage form={form} setForm={setForm} results={results} onSave={saveCustomer} onReport={() => setPage("report")} onReset={startNew} saved={saved} />}
        {page === "customers" && <CustomersPage customers={customers} onLoad={loadCustomer} onDelete={(id) => setCustomers((current) => current.filter((item) => item.id !== id))} startNew={startNew} />}
        {page === "report" && <ReportPage form={form} results={results} onBack={() => setPage("calculator")} />}
      </div>
    </div>
  );
}
