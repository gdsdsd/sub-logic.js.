// 브라우저 저장소에서 사용할 키입니다. 이 이름으로 구독 배열을 읽고 씁니다.
const STORAGE_KEY = "sulftracker-subscriptions";
// HTML에 준비된 폼과 목록을 찾아 이벤트를 연결합니다.
const form = document.querySelector("#subscription-form");
const list = document.querySelector("#subscription-list");
const cancelEditButton = document.querySelector("#cancel-edit");

let subscriptions = [];
// null이면 새 구독 등록, 문자열이면 해당 id의 기존 구독 수정 상태입니다.
let editingId = null;

// 구독마다 고유한 식별자를 만듭니다.
// 최신 브라우저에서는 UUID를 사용하고, 지원하지 않을 때는 시간과 난수를 조합합니다.
function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// localStorage에 저장된 JSON 문자열을 배열로 변환합니다.
function readSubscriptions() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  // 처음 방문해 저장값이 없으면 빈 구독 목록으로 시작합니다.
  if (!saved) return [];

  // JSON이 깨졌거나 배열이 아니면 호출한 쪽에 오류를 알려줍니다.
  const parsed = JSON.parse(saved);
  if (!Array.isArray(parsed)) {
    throw new TypeError("저장된 구독 데이터 형식이 올바르지 않습니다.");
  }
  return parsed;
}

// 변경될 전체 목록을 localStorage에 저장합니다.
function saveSubscriptions(nextSubscriptions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSubscriptions));
    return true;
  } catch (error) {
    // 저장 공간 부족이나 브라우저 권한 문제를 콘솔과 화면 양쪽에 표시합니다.
    console.error("구독 데이터를 저장하지 못했습니다.", error);
    showNotice("저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.", true);
    return false;
  }
}

// 현재 상태를 기준으로 요약, 카드, 카테고리 영역을 다시 그립니다.
function refresh() {
  renderDashboard(subscriptions);
}

// 수정 버튼을 눌렀을 때 선택한 데이터를 폼에 보여줍니다.
function beginEdit(id) {
  const subscription = subscriptions.find((item) => item.id === id);
  if (!subscription) {
    showNotice("수정할 구독을 찾을 수 없습니다.", true);
    return;
  }
  editingId = id;
  setFormMode(form, subscription);
  document.querySelector("#subscription-name").focus();
}

// 삭제 전 확인을 받고, 저장이 성공한 경우에만 화면의 상태를 변경합니다.
function deleteSubscription(id) {
  const subscription = subscriptions.find((item) => item.id === id);
  if (!subscription) {
    showNotice("삭제할 구독을 찾을 수 없습니다.", true);
    return;
  }
  if (!window.confirm(`"${subscription.name}" 구독을 삭제할까요?`)) return;

  // filter는 대상 id를 제외한 새 배열을 만듭니다.
  const nextSubscriptions = subscriptions.filter((item) => item.id !== id);
  if (!saveSubscriptions(nextSubscriptions)) return;

  subscriptions = nextSubscriptions;
  if (editingId === id) {
    editingId = null;
    resetFormMode(form);
  }
  refresh();
  showNotice("구독을 삭제했어요.");
}

// 폼 제출은 추가와 수정에서 공통으로 사용합니다.
form.addEventListener("submit", (event) => {
  // 페이지 새로고침을 막고 자바스크립트에서 저장과 화면 갱신을 처리합니다.
  event.preventDefault();
  if (!form.reportValidity()) return;

  // name 속성으로 각 입력값을 읽고 금액은 숫자로 변환합니다.
  const formData = new FormData(form);
  const amount = Number(formData.get("amount"));
  // HTML 입력 조건만으로 막기 어려운 큰 정수, 소수, 0 이하 금액도 확인합니다.
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    showNotice("금액은 1원 이상의 정수로 입력해 주세요.", true);
    return;
  }

  // UI가 필요로 하는 필드와 계산 함수가 기대하는 구조로 새 데이터를 만듭니다.
  const subscription = {
    id: editingId || createId(),
    name: String(formData.get("name")).trim(),
    amount,
    cycle: String(formData.get("cycle")),
    nextPaymentDate: String(formData.get("nextPaymentDate")),
    category: String(formData.get("category"))
  };

  // 수정 모드에서는 같은 id 항목만 교체하고, 추가 모드에서는 끝에 새 항목을 붙입니다.
  const nextSubscriptions = editingId
    ? subscriptions.map((item) => item.id === editingId ? subscription : item)
    : [...subscriptions, subscription];

  // 저장에 성공한 후에만 메모리 상태와 화면을 바꿉니다.
  if (!saveSubscriptions(nextSubscriptions)) return;

  subscriptions = nextSubscriptions;
  editingId = null;
  resetFormMode(form);
  refresh();
  showNotice("구독 정보를 저장했어요.");
});

// 목록 컨테이너 한 곳에서 수정/삭제 버튼 클릭을 처리합니다.
// 카드가 나중에 동적으로 만들어지므로 이벤트 위임 방식을 사용합니다.
list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  if (button.dataset.action === "edit") beginEdit(button.dataset.id);
  if (button.dataset.action === "delete") deleteSubscription(button.dataset.id);
});

// 취소를 누르면 수정 상태를 해제하고 입력 폼을 초기화합니다.
cancelEditButton.addEventListener("click", () => {
  editingId = null;
  resetFormMode(form);
});

// 페이지가 열릴 때 저장 데이터를 복구합니다.
try {
  subscriptions = readSubscriptions();
} catch (error) {
  console.error("저장된 구독 데이터를 불러오지 못했습니다.", error);
  showNotice("저장 데이터를 읽지 못했어요. 브라우저 콘솔에서 오류를 확인해 주세요.", true);
}

// 저장 데이터를 불러왔거나 오류를 알린 뒤 현재 목록을 화면에 표시합니다.
refresh();
