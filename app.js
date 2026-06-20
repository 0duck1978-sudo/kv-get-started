// Supabase 연동 설정
const SUPABASE_URL = "https://uoctovqlmmwbanqfrwfk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvY3RvdnFsbW13YmFucWZyd2ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjY2ODQsImV4cCI6MjA5NzQ0MjY4NH0.1jr3QYXQ9DwiNceI7Fdu0fk5V76_xnbDNOt-ex4V45Y";

// 공통 헤더 설정 (저장 및 수정을 허용하기 위한 헤더)
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
  emptyState: document.querySelector("#emptyState"),
  // 입출 입력 폼 요소들 추가
  form: document.querySelector("form") || document.querySelector(".input-section") || document.body,
  vendorInput: document.querySelector('input[placeholder*="업체"], #vendorInput') || document.querySelectorAll("input")[0],
  productInput: document.querySelector('input[placeholder*="품번"], #productInput') || document.querySelectorAll("input")[1],
  typeSelect: document.querySelector("select:not(#vendorFilter), #typeSelect") || document.querySelector("select"),
  qtyInput: document.querySelector('input[type="number"], input[placeholder*="수량"]') || document.querySelectorAll("input")[2],
  dateInput: document.querySelector('input[type="date"], input[placeholder*="일자"]') || document.querySelectorAll("input")[3],
  remarkInput: document.querySelector('input[placeholder*="비고"], #remarkInput') || document.querySelectorAll("input")[4],
  submitBtn: document.querySelector('button[type="submit"]') || document.querySelectorAll("button")[0]
};

let activeView = "stock"; 
let allData = [];

// 1. Supabase에서 실시간으로 전체 데이터 조회해오기
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
    setupButtonEvents();
  } catch (err) {
    console.error(err);
    if(els.emptyState) els.emptyState.textContent = "데이터를 불러오는 중 오류가 발생했습니다.";
  }
}

// 2. 홈페이지 등록 폼에서 [등록] 버튼을 누르면 Supabase에 즉시 반영 및 수정하는 함수
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const vendor = els.vendorInput.value.trim();
  const product = els.productInput.value.trim();
  const type = els.typeSelect ? els.typeSelect.value : "완성품 추가";
  const qty = Number(els.qtyInput.value || 0);
  const date = els.dateInput.value;
  const remark = els.remarkInput.value.trim();

  if (!vendor || !product) {
    alert("업체명과 품번은 필수 입력 사항입니다.");
    return;
  }

  // 기존에 이미 등록된 동일 업체 + 동일 품번이 있는지 검색
  const existingRow = allData.find(row => row.업체 === vendor && row.품번 === product);

  try {
    if (existingRow) {
      // [기존 제품 수정 모드]: 재고 수량을 누적 계산하여 업데이트
      let newStock = Number(existingRow.현재재고 || 0);
      let newBaseStock = Number(existingRow.기존재고 || 0);
      let newOrderQty = Number(existingRow.발주수량 || 0);

      if (type.includes("추가")) {
        newStock += qty;
        newBaseStock += qty;
      } else if (type.includes("출하")) {
        newStock -= qty;
      }

      const updateData = {
        기존재고: newBaseStock,
        현재재고: newStock,
        특이사항: remark || existingRow.특이사항
      };
      if (date) updateData.납기일자 = date;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/research?id=eq.${existingRow.id}`, {
        method: "PATCH",
        headers: headers,
        body: JSON.stringify(updateData)
      });

      if (!res.ok) throw new Error("데이터 수정 실패");
      alert(`[${vendor} - ${product}] 재고가 성공적으로 수정되었습니다!`);

    } else {
      // [새 제품 신규 등록 모드]: 수파베이스에 새로운 행 추가
      const insertData = {
        업체: vendor,
        품번: product,
        소번지: "-",
        기존재고: type.includes("추가") ? qty : 0,
        발주수량: 0,
        현재재고: type.includes("추가") ? qty : -qty,
        납기일자: date || null,
        특이사항: remark
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/research`, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(insertData)
      });

      if (!res.ok) throw new Error("신규 등록 실패");
      alert(`신규 제품 [${product}]이 등록되었습니다!`);
    }

    // 인풋 폼 초기화 및 새로고침
    if(els.form && els.form.reset) els.form.reset();
    fetchSupabaseData();

  } catch (err) {
    console.error(err);
    alert("Supabase 데이터 반영 중 오류가 발생했습니다. RLS 권한을 확인하세요.");
  }
}

function fmtNum(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? n.toLocaleString("ko-KR") : n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function populateFilters() {
  if (!els.vendorFilter) return;
  const vendors = [...new Set(allData.map(item => item.업체))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ko"));
  const currentFilter = els.vendorFilter.value;
  
  els.vendorFilter.innerHTML = `<option value="all">전체 업체</option>` + 
    vendors.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    
  if (currentFilter) els.vendorFilter.value = currentFilter;
}

function renderMetrics() {
  if (els.metricProducts) els.metricProducts.textContent = fmtNum(allData.length);
  if (els.metricVendors) els.metricVendors.textContent = fmtNum([...new Set(allData.map(item => item.업체))].filter(Boolean).length);
  if (els.metricShortages) els.metricShortages.textContent = fmtNum(allData.filter(row => Number(row.현재재고 || 0) < 0).length);
  if (els.metricStock) els.metricStock.textContent = fmtNum(allData.reduce((sum, row) => sum + Number(row.현재재고 || 0), 0));
}

function render() {
  renderMetrics();
  
  const query = els.searchInput ? els.searchInput.value.trim().toLowerCase() : "";
  const selectedVendor = els.vendorFilter ? els.vendorFilter.value : "all";
  
  const filtered = allData.filter(row => {
    if (activeView === "shortage" && Number(row.현재재고 || 0) >= 0) return false;
    if (activeView === "delivery" && !row.납기일자) return false;
    if (activeView === "completed" && Number(row.현재재고 || 0) <= 0) return false;

    const matchVendor = selectedVendor === "all" || row.업체 === selectedVendor;
    const text = `${row.품번} ${row.소번지} ${row.특이사항}`.toLowerCase();
    const matchQuery = !query || text.includes(query);
    return matchVendor && matchQuery;
  });

  if (els.emptyState) els.emptyState.style.display = filtered.length ? "none" : "block";
  if (els.tableHead) els.tableHead.innerHTML = `<tr><th>업체</th><th>품번</th><th>소번지</th><th>기존재고</th><th>발주수량</th><th>현재재고</th><th>납기일자</th><th>상태</th><th>특이사항</th></tr>`;
  
  if (els.tableBody) {
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
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function setupButtonEvents() {
  const buttons = document.querySelectorAll("button, .nav-btn");
  buttons.forEach(btn => {
    const txt = btn.textContent.trim();
    if (txt === "재고") {
      btn.addEventListener("click", (e) => { e.preventDefault(); changeActiveTab(btn); activeView = "stock"; render(); });
    } else if (txt === "부족현황") {
      btn.addEventListener("click", (e) => { e.preventDefault(); changeActiveTab(btn); activeView = "shortage"; render(); });
    } else if (txt === "품번조회") {
      btn.addEventListener("click", (e) => { e.preventDefault(); changeActiveTab(btn); activeView = "product"; render(); if(els.searchInput) els.searchInput.focus(); });
    } else if (txt === "납품/납기조회") {
      btn.addEventListener("click", (e) => { e.preventDefault(); changeActiveTab(btn); activeView = "delivery"; render(); });
    } else if (txt === "납품완료") {
      btn.addEventListener("click", (e) => { e.preventDefault(); changeActiveTab(btn); activeView = "completed"; render(); });
    } else if (txt === "입출내역") {
      btn.addEventListener("click", (e) => { e.preventDefault(); changeActiveTab(btn); activeView = "history"; render(); });
    }
  });
}

function changeActiveTab(activeBtn) {
  const buttons = document.querySelectorAll("button, .nav-btn");
  buttons.forEach(btn => {
    const t = btn.textContent.trim();
    if(["재고","부족현황","품번조회","납품/납기조회","납품완료","입출내역"].includes(t)) {
      btn.style.backgroundColor = "";
      btn.style.color = "";
    }
  });
  activeBtn.style.backgroundColor = "#1e40af";
  activeBtn.style.color = "#ffffff";
}

// 등록 이벤트 바인딩 활성화
if (els.submitBtn) {
  els.submitBtn.addEventListener("click", handleFormSubmit);
} else if (els.form) {
  els.form.addEventListener("submit", handleFormSubmit);
}

if (els.vendorFilter) els.vendorFilter.addEventListener("change", render);
if (els.searchInput) els.searchInput.addEventListener("input", render);

// 최초 실행
fetchSupabaseData();
