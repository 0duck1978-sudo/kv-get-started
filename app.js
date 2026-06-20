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
  emptyState: document.querySelector("#emptyState")
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
    bindRegisterEvent(); // 등록 버튼 이벤트 강제 연결
  } catch (err) {
    console.error(err);
    if(els.emptyState) els.emptyState.textContent = "데이터를 불러오는 중 오류가 발생했습니다.";
  }
}

// 2. 홈페이지 등록 양식에서 값을 읽어와 Supabase에 직접 쓰고 수정하는 기능
async function handleFormSubmit(e) {
  if (e) e.preventDefault();
  
  // 현재 화면 구조에서 입력창들 직접 추출
  const inputs = document.querySelectorAll("input");
  const select = document.querySelector("select:not(#vendorFilter)");
  
  const vendor = inputs[0] ? inputs[0].value.trim() : "";
  const product = inputs[1] ? inputs[1].value.trim() : "";
  const type = select ? select.value : "완성품 추가";
  const qty = inputs[2] ? Number(inputs[2].value || 0) : 0;
  const date = inputs[3] ? inputs[3].value : "";
  const remark = inputs[4] ? inputs[4].value.trim() : "";

  if (!vendor || !product) {
    alert("업체명과 품번은 필수 입력 사항입니다.");
    return;
  }

  // 기존 데이터 존재 여부 파악
  const existingRow = allData.find(row => row.업체 === vendor && row.품번 === product);

  try {
    if (existingRow) {
      // [수정 모드]: 기존 수량에 더하거나 빼서 계산
      let newStock = Number(existingRow.현재재고 || 0);
      let newBaseStock = Number(existingRow.기존재고 || 0);

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

      if (!res.ok) throw new Error("수정 실패");
      alert(`[${vendor} - ${product}] 재고가 정상적으로 업데이트되었습니다.`);

    } else {
      // [신규 등록 모드]: 새로운 데이터 행 추가
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

      if (!res.ok) throw new Error("등록 실패");
      alert(`새로운 제품 [${product}]이 등록되었습니다.`);
    }

    // 입력란 초기화 및 화면 갱신
    inputs.forEach((input, idx) => { if(idx < 5) input.value = ""; });
    fetchSupabaseData();

  } catch (err) {
    console.error(err);
    alert("데이터베이스 전송에 실패했습니다. 입력한 값을 다시 확인해 주세요.");
  }
}

// 등록 버튼 이벤트 강제 바인딩 함수
function bindRegisterEvent() {
  const allBtns = document.querySelectorAll("button");
  allBtns.forEach(btn => {
    if (btn.textContent.trim() === "등록") {
      // 중복 연결 방지를 위해 초기화 후 재연결
      btn.removeAttribute("onclick");
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener("click", handleFormSubmit);
    }
  });
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

// 최초 실행
fetchSupabaseData();
