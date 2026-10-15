// 한국 원화 표기를 브라우저의 한국어 숫자 형식으로 처리하는 도구입니다.
const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0
});

// HTML 문자열을 해석하지 않고 DOM 요소와 텍스트를 만듭니다.
// 사용자 입력을 textContent로 넣어 텍스트가 HTML로 실행되는 일을 막습니다.
function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// 날짜 입력을 현지 시간 기준 YYYY-MM-DD 문자열로 만듭니다.
// toISOString()은 UTC 날짜로 바뀔 수 있어 현지 날짜를 직접 조합합니다.
function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 화면 상단 통계와 목록 개수 갱신
function renderSummary(subscriptions) {
  // 총액 계산은 기존 logic.js의 함수를 사용합니다.
  document.querySelector("#monthly-total").textContent =
    won.format(window.getTotalMonthlyAmount(subscriptions));
  document.querySelector("#yearly-total").textContent =
    won.format(window.getTotalYearlyAmount(subscriptions));
  document.querySelector("#upcoming-count").textContent =
    `${window.getUpcomingPayments(subscriptions, 7).length}건`;
  document.querySelector("#subscription-count").textContent =
    `${subscriptions.length}개`;
}

// 구독 배열을 카드 목록으로 바꿔 화면에 표시합니다.
function renderSubscriptions(subscriptions) {
  const list = document.querySelector("#subscription-list");
  // 매번 새로 그리므로 이전 렌더링의 오래된 카드부터 지웁니다.
  list.replaceChildren();

  // 데이터가 없을 때는 빈 목록 대신 다음 행동을 안내합니다.
  if (subscriptions.length === 0) {
    list.append(makeElement("p", "empty-state", "아직 등록된 구독이 없어요.\n오른쪽 폼에서 첫 구독을 추가해 보세요."));
    return;
  }

  // 날짜 비교에는 시간 부분이 없는 오늘 날짜 문자열을 전달합니다.
  const today = localDateString();
  for (const subscription of subscriptions) {
    // 카드의 요소를 직접 만들어 사용자 입력을 안전한 텍스트로 표시합니다.
    const card = makeElement("article", "subscription-card");
    const top = makeElement("div", "subscription-top");
    const titleGroup = document.createElement("div");
    const title = makeElement("h3", "subscription-name", subscription.name);
    const category = makeElement("span", "category-tag", subscription.category);
    titleGroup.append(title, category);

    // 연간 결제 구독은 logic.js 계산 함수가 월 금액으로 환산합니다.
    const monthlyAmount = window.getMonthlyAmount(subscription);
    const amountGroup = document.createElement("div");
    amountGroup.append(
      makeElement("p", "subscription-amount", `${won.format(monthlyAmount)} /월`),
      makeElement("p", "cycle-caption", subscription.cycle === "yearly"
        ? `${won.format(Number(subscription.amount))} 매년 결제`
        : `${won.format(Number(subscription.amount))} 매월 결제`)
    );

    // 음수는 결제일이 지난 상태, 0은 오늘, 양수는 미래 날짜입니다.
    const days = window.getDaysUntilNextPayment(today, subscription.nextPaymentDate);
    const daysLabel = days < 0
      ? `${Math.abs(days)}일 지남`
      : days === 0
        ? "오늘 결제"
        : `D-${days}`;
    const bottom = makeElement("div", "subscription-bottom");
    const paymentInfo = document.createElement("div");
    paymentInfo.append(
      makeElement("p", `days-badge${days >= 0 && days <= 3 ? " is-soon" : ""}`, daysLabel),
      makeElement("p", "payment-date", `다음 결제 ${subscription.nextPaymentDate}`)
    );

    // 버튼에는 동작 종류와 구독 id를 기록해 목록 이벤트에서 구분합니다.
    const actions = makeElement("div", "card-actions");
    const editButton = makeElement("button", "text-button", "수정");
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.dataset.id = subscription.id;
    const deleteButton = makeElement("button", "text-button delete-button", "삭제");
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = subscription.id;
    actions.append(editButton, deleteButton);

    top.append(titleGroup);
    card.append(top, amountGroup);
    bottom.append(paymentInfo, actions);
    card.append(bottom);
    list.append(card);
  }
}

// 카테고리별 월 금액과 전체 월 지출에서 차지하는 비율을 표시합니다.
function renderCategories(subscriptions) {
  const container = document.querySelector("#category-list");
  container.replaceChildren();

  // 합계를 계산할 데이터가 없다면 빈 상태 안내를 보여줍니다.
  if (subscriptions.length === 0) {
    container.append(makeElement("p", "empty-category", "구독을 추가하면 카테고리 비중이 표시돼요."));
    return;
  }

  // logic.js가 돌려준 카테고리별 합계를 큰 금액 순으로 정렬합니다.
  const totals = window.getMonthlyAmountByCategory(subscriptions);
  const entries = Object.entries(totals).sort((first, second) => second[1] - first[1]);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

  for (const [category, amount] of entries) {
    const item = makeElement("div", "category-item");
    const heading = makeElement("div", "category-heading");
    // 0으로 나누는 상황을 피하고 각 카테고리의 정수 백분율을 계산합니다.
    const percent = total > 0 ? Math.round((amount / total) * 100) : 0;
    heading.append(
      makeElement("span", "category-name", category),
      makeElement("span", "category-share", `${won.format(amount)} · ${percent}%`)
    );
    const track = makeElement("div", "category-track");
    track.setAttribute("aria-label", `${category} ${percent}%`);
    const fill = makeElement("div", "category-fill");
    fill.style.width = `${percent}%`;
    track.append(fill);
    item.append(heading, track);
    container.append(item);
  }
}

// 데이터가 바뀌었을 때 화면의 모든 영역을 한 번에 다시 그립니다.
function renderDashboard(subscriptions) {
  renderSummary(subscriptions);
  renderSubscriptions(subscriptions);
  renderCategories(subscriptions);
}

// 성공 또는 오류 메시지를 잠시 보여준 후 자동으로 감춥니다.
function showNotice(message, isError = false) {
  const notice = document.querySelector("#notice");
  notice.textContent = message;
  notice.classList.toggle("is-error", isError);
  notice.classList.add("is-visible");
  window.clearTimeout(showNotice.timeoutId);
  showNotice.timeoutId = window.setTimeout(() => {
    notice.classList.remove("is-visible", "is-error");
  }, 3200);
}

// 기존 구독 정보를 폼에 채우고 폼을 수정 모드로 바꿉니다.
function setFormMode(form, subscription) {
  form.elements.namedItem("name").value = subscription.name;
  form.elements.namedItem("amount").value = subscription.amount;
  form.elements.namedItem("cycle").value = subscription.cycle;
  form.elements.namedItem("nextPaymentDate").value = subscription.nextPaymentDate;
  form.elements.namedItem("category").value = subscription.category;
  document.querySelector("#form-heading").textContent = "구독 수정";
  document.querySelector("#submit-button").textContent = "변경 저장";
  document.querySelector("#cancel-edit").hidden = false;
}

// 폼 값을 비우고 제목과 버튼을 새 구독 추가 모드로 되돌립니다.
function resetFormMode(form) {
  form.reset();
  document.querySelector("#form-heading").textContent = "새 구독 추가";
  document.querySelector("#submit-button").textContent = "구독 추가";
  document.querySelector("#cancel-edit").hidden = true;
}
