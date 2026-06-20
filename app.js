// Supabase 연동 설정
const SUPABASE_URL = "https://uoctovqlmmwbanqfrwfk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvY3RvdnFsbW13YmFucWZyd2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjY2ODQsImV4cCI6MjA5NzQ0MjY4NH0.1jr3QYXQ9DwiNceI7Fdu0fk5V76_xnbDNOt-ex4V45Y";

// 공통 헤더 설정
const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

// 메인 요소들 정의
const els = {
  metricProducts: document.querySelector("#metricProducts"),
  metricVendors: document.querySelector("#metricVendors"),
  metricShortages: document.querySelector("#metricShortages"),
  metricStock: document.querySelector("#metricStock"),
  vendorFilter: document.querySelector("#vendorFilter"),
  searchInput: document.querySelector("#searchInput"),
  tableHead: document.querySelector("#tableHead"),
  tableBody: document.querySelector("#tableBody"),
  emptyState: document.querySelector("#emptyState")
};

let activeView = "stock";
let allData = [];

// 1. Supabase에서 'research' 테이블 데이터 실시간 가져오기
async function fetchSupabaseData() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/research?select=*`, {
      method: "GET",
      headers: headers
    });
    if (!response.ok) throw new Error("데이터 로드 실패");
    allData = await response.json();
    populateFilters();
    render();
  } catch (err) {
    console.error(err);
    els.emptyState.textContent = "데이터를 불러오는 중 오류가 발생했습니다.";
  }
}

function fmtNum(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function populateFilters() {
  const vendors = [...new Set(allData.map(item => item.업체))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ko"));
  const currentFilter = els.vendorFilter.value;
  
  els.vendorFilter.innerHTML = `<option value="all">전체 업체</option>` + 
    vendors.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    
  if (currentFilter) els.vendorFilter.value = currentFilter;
}

function renderMetrics() {
  if (!els.metricProducts) return;
  els.metricProducts.textContent = fmtNum(allData.length);
  els.metricVendors.textContent = fmtNum([...new Set(allData.map(item => item.업체))].filter(Boolean).length);
  els.metricShortages.textContent = fmtNum(allData.filter(row => Number(row.현재재고 || 0) < 0).length);
  els.metricStock.textContent = fmtNum(allData.reduce((sum, row) => sum + Number(row.현재재고 || 0), 0));
}

function render() {
  renderMetrics();
  
  const query = els.searchInput.value.trim().toLowerCase();
  const selectedVendor = els.vendorFilter.value;
  
  const filtered = allData.filter(row => {
    const matchVendor = selectedVendor === "all" || row.업체 === selectedVendor;
    const text = `${row.품번} ${row.소번지} ${row.특이사항}`.toLowerCase();
    const matchQuery = !query || text.includes(query);
    return matchVendor && matchQuery;
  });

  els.emptyState.style.display = filtered.length ? "none" : "block";
  
  els.tableHead.innerHTML = `<tr><th>업체</th><th>품번</th><th>소번지</th><th>기존재고</th><th>발주수량</th><th>현재재고</th><th>납기일자</th><th>상태</th><th>특이사항</th></tr>`;
  
  els.tableBody.innerHTML = filtered.map(row => {
    const available = Number(row.현재재고 || 0);
    const status = available < 0 ? "부족" : available === 0 ? "소진" : "보유";
    const badgeClass = status === "부족" ? "bad" : status === "소진" ? "warn" : "good";
    
    return `<tr>
      <td>${escapeHtml(row.업체)}</td>
      <td><span class="num">${escapeHtml(row.품번)}</span></td>
      <td>${escapeHtml(row.소번지)}</td>
      <td><span class="num">${fmtNum(row.기존재고)}</span></td>
      <td><span class="num">${fmtNum(row.발주수량)}</span></td>
      <td><span class="num">${fmtNum(row.현재재고)}</span></td>
      <td>${escapeHtml(row.납기일자 || "")}</td>
      <td><span class="badge ${badgeClass}">${status}</span></td>
      <td>${escapeHtml(row.특이사항 || "")}</td>
    </tr>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// 이벤트 리스너 등록
els.vendorFilter.addEventListener("change", render);
els.searchInput.addEventListener("input", render);

// 최초 실행
fetchSupabaseData();
