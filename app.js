/* =========================================================
   코레일 차량정비 안전교육·테스트 — 앱 로직
   의존성 없음. data.js의 KOSHA_SOURCE / CATEGORIES / CASES / QUIZ / TBM_GROUPS 사용.
   ========================================================= */
(function () {
  'use strict';

  var KEY = {
    learned: 'korailSafety.v1.learned',
    scores: 'korailSafety.v1.scores',
    tbm: 'korailSafety.v1.tbm'
  };

  function readStore(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* 저장 공간이 없는 브라우저(사생활 보호 모드 등)에서는 조용히 무시 */
    }
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var state = {
    view: 'home',
    filter: 'all',
    openCases: {},
    learned: readStore(KEY.learned, []),
    scores: readStore(KEY.scores, []),
    tbm: readStore(KEY.tbm, {}),
    quiz: null
  };

  if (!Array.isArray(state.learned)) state.learned = [];
  if (!Array.isArray(state.scores)) state.scores = [];
  if (!state.tbm || typeof state.tbm !== 'object') state.tbm = {};

  var caseById = {};
  CASES.forEach(function (c) { caseById[c.id] = c; });

  var TBM_TOTAL = 0;
  TBM_GROUPS.forEach(function (g) { TBM_TOTAL += g.items.length; });

  /* ── 공통 유틸 ─────────────────────────────────────── */
  function pct(part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  }

  function isLearned(id) {
    return state.learned.indexOf(id) !== -1;
  }

  function catCount(cat) {
    if (cat === 'all') return CASES.length;
    return CASES.filter(function (c) { return c.cat === cat; }).length;
  }

  function categories() {
    return CATEGORIES;
  }

  function shuffle(list) {
    var arr = list.slice();
    for (var i = arr.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var mm = d.getMonth() + 1;
    var dd = d.getDate();
    var hh = d.getHours();
    var mi = d.getMinutes();
    return mm + '월 ' + dd + '일 ' + (hh < 10 ? '0' + hh : hh) + ':' + (mi < 10 ? '0' + mi : mi);
  }

  /* ── 화면 전환 ─────────────────────────────────────── */
  function setView(name, opts) {
    if (!document.getElementById('view-' + name)) name = 'home';
    state.view = name;

    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i += 1) {
      views[i].classList.toggle('is-active', views[i].id === 'view-' + name);
    }
    var tabButtons = document.querySelectorAll('[data-view]');
    for (var k = 0; k < tabButtons.length; k += 1) {
      tabButtons[k].classList.toggle('is-active', tabButtons[k].getAttribute('data-view') === name);
    }

    if (name === 'home') renderHome();
    if (name === 'learn') renderLearn();
    if (name === 'quiz') renderQuiz();
    if (name === 'tbm') renderTbm();

    if (window.history && window.history.replaceState) {
      try { window.history.replaceState(null, '', '#' + name); } catch (e) { /* 무시 */ }
    }
    window.scrollTo(0, 0);
    if (opts && opts.focusSelector) {
      var target = document.querySelector(opts.focusSelector);
      if (target) {
        setTimeout(function () {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.focus({ preventScroll: true });
        }, 60);
      }
    }
  }

  /* ── 홈 ────────────────────────────────────────────── */
  function renderHome() {
    var learnedCount = state.learned.filter(function (id) { return caseById[id]; }).length;
    var total = CASES.length;
    document.getElementById('stat-learned').textContent = String(learnedCount);
    document.getElementById('stat-total').textContent = String(total);
    document.getElementById('stat-learn-bar').style.width = pct(learnedCount, total) + '%';
    var learnFoot = document.getElementById('stat-learn-foot');
    if (learnedCount === 0) {
      learnFoot.textContent = '학습한 사례가 없습니다. 사고사례 학습부터 시작해 보세요.';
    } else if (learnedCount === total) {
      learnFoot.textContent = '모든 사례를 학습했습니다. 안전 테스트로 실력을 확인해 보세요.';
    } else {
      learnFoot.textContent = '남은 사례 ' + (total - learnedCount) + '건 · ' + pct(learnedCount, total) + '% 완료';
    }

    var last = state.scores.length ? state.scores[state.scores.length - 1] : null;
    var scoreEl = document.getElementById('stat-score');
    var scoreFoot = document.getElementById('stat-score-foot');
    if (last) {
      scoreEl.textContent = String(last.pct);
      scoreFoot.textContent = (last.pass ? '합격' : '불합격') + ' · ' + formatDate(last.at) + ' · ' + last.correct + '/' + last.total + '문항';
    } else {
      scoreEl.textContent = '-';
      scoreFoot.textContent = '아직 응시 기록이 없습니다.';
    }

    var passCount = state.scores.filter(function (s) { return s.pass; }).length;
    document.getElementById('stat-attempts').textContent = String(state.scores.length);
    document.getElementById('stat-pass-foot').textContent = '합격 기준 80점 · 합격 ' + passCount + '회';

    document.getElementById('src-name').textContent = KOSHA_SOURCE.datasetName;
    document.getElementById('src-provider').textContent = KOSHA_SOURCE.provider;
    document.getElementById('src-coverage').textContent = KOSHA_SOURCE.coverage;
    document.getElementById('src-license').textContent = KOSHA_SOURCE.license;
    document.getElementById('src-retrieved').textContent = KOSHA_SOURCE.retrieved + ' 조회 · 원본 파일 ' + KOSHA_SOURCE.fileUpdated + ' 기준';
    document.getElementById('link-data').setAttribute('href', KOSHA_SOURCE.datasetUrl);
    document.getElementById('link-file').setAttribute('href', KOSHA_SOURCE.filePageUrl);
  }

  /* ── 사고사례 학습 ─────────────────────────────────── */
  function renderFilters() {
    var row = document.getElementById('filter-row');
    var html = categories().map(function (cat) {
      var active = state.filter === cat.id ? ' is-active' : '';
      return '<button type="button" class="chip' + active + '" data-filter="' + cat.id + '">' +
        esc(cat.name) + '<span class="chip-count">' + catCount(cat.id) + '</span></button>';
    }).join('');
    row.innerHTML = html;
  }

  function measureList(text) {
    return String(text || '').split('\n').map(function (line) {
      return line.trim();
    }).filter(function (line) {
      return line.length > 0;
    }).map(function (line) {
      return '<li>' + esc(line) + '</li>';
    }).join('');
  }

  function caseCard(c) {
    var learned = isLearned(c.id);
    var open = !!state.openCases[c.id];
    var laws = c.laws.map(function (law) {
      return '<li><span class="law-ref">' + esc(law.article) + ' ' + esc(law.title) + '</span>' +
        '<span class="law-desc">' + esc(law.desc) + '</span></li>';
    }).join('');

    return '' +
      '<article class="case-card' + (open ? ' is-open' : '') + (learned ? ' is-done' : '') + '" data-cat="' + c.cat + '" data-id="' + c.id + '">' +
        '<button type="button" class="case-head" data-action="toggle-case" aria-expanded="' + (open ? 'true' : 'false') + '" aria-controls="body-' + c.id + '">' +
          '<span>' +
            '<span class="case-meta">' +
              '<span class="tag tag-cat" data-cat="' + c.cat + '">' + esc(c.catName) + '</span>' +
              '<span class="tag tag-no">KOSHA 연번 ' + c.no + '</span>' +
              (c.year ? '<span class="tag tag-year">' + c.year + '년 발생</span>' : '') +
            '</span>' +
            '<span class="case-summary">' + esc(c.summary) + '</span>' +
            '<span class="case-ind">' + esc(c.industry) + '</span>' +
          '</span>' +
          '<span class="case-chev">' + (open ? '상세 닫기' : '상세 보기') + '</span>' +
        '</button>' +
        '<div class="case-body" id="body-' + c.id + '">' +
          '<div class="detail-grid">' +
            '<div class="detail"><h4>기인물</h4><p>' + esc(c.object) + '</p></div>' +
            '<div class="detail"><h4>고위험작업·상황</h4><p>' + esc(c.highrisk) + '</p></div>' +
            '<div class="detail"><h4>재해유발요인</h4><p>' + esc(c.precursor) + '</p></div>' +
            '<div class="detail detail-measure"><h4>위험성 감소대책 (KOSHA 원문)</h4><ul class="multi measure-list">' + measureList(c.measure) + '</ul></div>' +
            '<div class="detail detail-point"><h4>차량정비 적용 포인트 (앱 해설)</h4><p>' + esc(c.point) + '</p></div>' +
            '<div class="detail detail-laws"><h4>관련 법규 (앱 해설)</h4><ul class="law-list">' + laws + '</ul></div>' +
          '</div>' +
          '<div class="case-actions">' +
            '<button type="button" class="btn-done" data-action="toggle-learned" aria-pressed="' + (learned ? 'true' : 'false') + '">' +
              '<span class="box" aria-hidden="true"></span>' + (learned ? '학습 완료' : '학습 완료로 표시') +
            '</button>' +
            '<span class="quiz-hint">이 사례는 안전 테스트 문항의 근거 자료입니다.</span>' +
          '</div>' +
          '<p class="src-line">출처: 공공데이터포털 「' + esc(KOSHA_SOURCE.datasetName) + '」 연번 ' + c.no +
            ' — 재해개요·기인물·고위험작업·재해유발요인·위험성 감소대책은 원문 그대로 인용(무변경).</p>' +
        '</div>' +
      '</article>';
  }

  function renderLearn() {
    renderFilters();
    document.getElementById('learn-total').textContent = String(CASES.length);
    var learnedCount = state.learned.filter(function (id) { return caseById[id]; }).length;
    document.getElementById('learn-progress').textContent = learnedCount + ' / ' + CASES.length + ' 완료';

    var visible = state.filter === 'all'
      ? CASES
      : CASES.filter(function (c) { return c.cat === state.filter; });

    document.getElementById('case-list').innerHTML = visible.map(caseCard).join('');
    document.getElementById('learn-empty').hidden = visible.length !== 0;
  }

  function toggleLearned(id) {
    if (!caseById[id]) return;
    var idx = state.learned.indexOf(id);
    if (idx === -1) state.learned.push(id);
    else state.learned.splice(idx, 1);
    writeStore(KEY.learned, state.learned);
    renderLearn();
  }

  function jumpToCase(caseId) {
    state.filter = 'all';
    state.openCases[caseId] = true;
    setView('learn', { focusSelector: '.case-card[data-id="' + caseId + '"] .case-head' });
  }

  /* ── 안전 테스트 ───────────────────────────────────── */
  function renderQuiz() {
    if (!state.quiz) renderQuizStart();
    else if (state.quiz.finished) renderQuizResult();
    else renderQuizQuestion();
  }

  function renderQuizStart() {
    var recent = state.scores.slice(-3).reverse();
    var recentHtml = recent.length
      ? '<ul class="law-list" style="margin-top:12px">' + recent.map(function (s) {
          return '<li>' + formatDate(s.at) + ' · ' + s.correct + '/' + s.total +
            ' · <strong>' + s.pct + '점 ' + (s.pass ? '합격' : '불합격') + '</strong></li>';
        }).join('') + '</ul>'
      : '<p class="quiz-hint">아직 응시 기록이 없습니다.</p>';

    document.getElementById('quiz-root').innerHTML = '' +
      '<div class="quiz-card quiz-intro">' +
        '<h2>실전 안전 테스트</h2>' +
        '<p>KOSHA 중대재해 사례에서 뽑은 4지선다 ' + QUIZ.length + '문항입니다. 답을 고르면 바로 정답·오답과 해당 사례 해설이 나옵니다. ' +
          '<strong>80점 이상</strong>이면 합격입니다.</p>' +
        '<div class="quiz-choices">' +
          '<button type="button" class="quiz-choice" data-action="start-quiz" data-mode="random10">' +
            '<span>랜덤 10문항으로 시작<span class="choice-sub"><br>매번 다른 조합으로 짧게 점검</span></span><span aria-hidden="true">→</span>' +
          '</button>' +
          '<button type="button" class="quiz-choice" data-action="start-quiz" data-mode="all">' +
            '<span>전체 ' + QUIZ.length + '문항 풀기<span class="choice-sub"><br>모든 사례를 한 번에 확인</span></span><span aria-hidden="true">→</span>' +
          '</button>' +
        '</div>' +
        '<div class="answer-case"><strong>최근 응시 기록</strong>' + recentHtml + '</div>' +
      '</div>';
  }

  function startQuiz(mode, questionList) {
    var list;
    if (questionList && questionList.length) {
      list = questionList.slice();
    } else if (mode === 'random10') {
      list = shuffle(QUIZ).slice(0, Math.min(10, QUIZ.length));
    } else {
      list = shuffle(QUIZ);
    }
    state.quiz = {
      mode: mode,
      questions: list,
      idx: 0,
      answers: [],
      selected: null,
      revealed: false,
      finished: false
    };
    renderQuiz();
  }

  function correctSoFar() {
    var n = 0;
    state.quiz.answers.forEach(function (a) { if (a.correct) n += 1; });
    return n;
  }

  function renderQuizQuestion() {
    var quiz = state.quiz;
    var question = quiz.questions[quiz.idx];
    var c = caseById[question.caseId];
    var answered = quiz.revealed;

    var optionsHtml = question.options.map(function (opt, i) {
      var cls = 'option';
      if (answered) {
        if (i === question.answer) cls += ' is-correct';
        else if (i === quiz.selected) cls += ' is-wrong';
      }
      return '<button type="button" class="' + cls + '" data-action="answer" data-index="' + i + '"' +
        (answered ? ' disabled' : '') + '>' +
        '<span class="letter" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span>' + esc(opt) + '</span></button>';
    }).join('');

    var answerHtml = '';
    if (answered) {
      var ok = quiz.selected === question.answer;
      answerHtml = '' +
        '<div class="answer-box ' + (ok ? 'ok' : 'no') + '">' +
          '<p class="answer-head">' + (ok ? '✓ 정답입니다' : '✕ 오답입니다') + '</p>' +
          '<p class="answer-text">' + esc(question.explain) + '</p>' +
          '<p class="answer-law">근거 법규: ' + esc(question.law) + '</p>' +
          '<p class="answer-case"><strong>관련 KOSHA 사례 (연번 ' + c.no + ')</strong><br>' + esc(c.summary) +
            '<br><button type="button" class="case-link" data-action="jump-case" data-id="' + c.id + '">사례 상세 보기 →</button></p>' +
        '</div>';
    }

    document.getElementById('quiz-root').innerHTML = '' +
      '<div class="quiz-card">' +
        '<div class="quiz-top">' +
          '<span class="quiz-count">문제 ' + (quiz.idx + 1) + ' / ' + quiz.questions.length + '</span>' +
          '<span class="quiz-score">현재 ' + correctSoFar() + '문항 정답 · ' +
            (quiz.mode === 'random10' ? '랜덤 10문항' : '전체 문항') + '</span>' +
        '</div>' +
        '<div class="bar" style="margin-bottom:16px"><span class="bar-fill" style="width:' +
          pct(quiz.idx, quiz.questions.length) + '%"></span></div>' +
        '<h2 class="quiz-q">' + esc(question.q) + '</h2>' +
        '<div class="quiz-qmeta">' +
          '<span class="tag tag-cat" data-cat="' + question.cat + '">' + esc(c.catName) + '</span>' +
          '<span class="tag tag-no">사례 근거 KOSHA 연번 ' + c.no + '</span>' +
        '</div>' +
        '<div class="options">' + optionsHtml + '</div>' +
        answerHtml +
        '<div class="quiz-nav">' +
          '<span class="quiz-hint">' + (answered ? '해설을 확인한 뒤 다음 문제로 넘어가세요.' : '답을 고르면 즉시 채점됩니다.') + '</span>' +
          '<button type="button" class="btn btn-primary" data-action="next-question"' + (answered ? '' : ' disabled') + '>' +
            (quiz.idx + 1 === quiz.questions.length ? '결과 보기' : '다음 문제') + '</button>' +
        '</div>' +
      '</div>';
  }

  function answerQuestion(index) {
    var quiz = state.quiz;
    if (!quiz || quiz.revealed) return;
    var question = quiz.questions[quiz.idx];
    quiz.selected = index;
    quiz.revealed = true;
    quiz.answers.push({
      qid: question.id,
      caseId: question.caseId,
      selected: index,
      answer: question.answer,
      correct: index === question.answer
    });
    renderQuizQuestion();
  }

  function nextQuestion() {
    var quiz = state.quiz;
    if (!quiz || !quiz.revealed) return;
    if (quiz.idx + 1 >= quiz.questions.length) {
      finishQuiz();
      return;
    }
    quiz.idx += 1;
    quiz.selected = null;
    quiz.revealed = false;
    renderQuizQuestion();
    window.scrollTo(0, 0);
  }

  function finishQuiz() {
    var quiz = state.quiz;
    var correct = correctSoFar();
    var total = quiz.questions.length;
    var score = pct(correct, total);
    quiz.finished = true;
    quiz.score = score;
    quiz.correctCount = correct;

    var record = {
      at: new Date().toISOString(),
      correct: correct,
      total: total,
      pct: score,
      pass: score >= 80,
      mode: quiz.mode
    };
    state.scores.push(record);
    if (state.scores.length > 30) state.scores = state.scores.slice(-30);
    writeStore(KEY.scores, state.scores);
    renderQuizResult();
    window.scrollTo(0, 0);
  }

  function renderQuizResult() {
    var quiz = state.quiz;
    var total = quiz.questions.length;
    var correct = quiz.correctCount;
    var score = quiz.score;
    var pass = score >= 80;
    var wrong = quiz.answers.filter(function (a) { return !a.correct; });

    var wrongHtml = '';
    if (wrong.length) {
      wrongHtml = '<div class="wrong-note"><h3>오답 노트 (' + wrong.length + '문항)</h3>' + wrong.map(function (a) {
        var question = null;
        for (var i = 0; i < QUIZ.length; i += 1) { if (QUIZ[i].id === a.qid) question = QUIZ[i]; }
        if (!question) return '';
        var c = caseById[question.caseId];
        return '<div class="wrong-item">' +
          '<p class="wq">' + esc(question.q) + '</p>' +
          '<p class="wa">내 답: ' + esc(question.options[a.selected]) + '<br><b>정답: ' + esc(question.options[a.answer]) + '</b></p>' +
          '<p class="we">' + esc(question.explain) + ' <br>근거 법규: ' + esc(question.law) +
            ' <br><button type="button" class="case-link" data-action="jump-case" data-id="' + c.id + '">KOSHA 연번 ' + c.no + ' 사례 보기 →</button></p>' +
          '</div>';
      }).join('') + '</div>';
    } else {
      wrongHtml = '<div class="wrong-note"><h3>오답 노트</h3><p class="quiz-hint">틀린 문항이 없습니다. 모든 문항을 정확히 이해했습니다.</p></div>';
    }

    var reBtn = wrong.length
      ? '<button type="button" class="btn btn-outline" data-action="retry-wrong">틀린 ' + wrong.length + '문항만 재응시</button>'
      : '';

    document.getElementById('quiz-root').innerHTML = '' +
      '<div class="quiz-card">' +
        '<div class="result-head">' +
          '<div class="result-ring" style="--pct:' + score + '%"><span>' + score + '<small>점</small></span></div>' +
          '<p class="result-title ' + (pass ? 'pass' : 'fail') + '">' + (pass ? '합격입니다' : '불합격입니다') + '</p>' +
          '<p class="result-sub">' + (pass
            ? '80점 기준을 통과했습니다. 현장 TBM 체크리스트로 마무리해 보세요.'
            : '80점 이상이어야 합격입니다. 오답 노트를 확인하고 재응시해 보세요.') + '</p>' +
        '</div>' +
        '<div class="result-stats">' +
          '<div class="result-stat"><b>' + correct + '</b><span>정답</span></div>' +
          '<div class="result-stat"><b>' + (total - correct) + '</b><span>오답</span></div>' +
          '<div class="result-stat"><b>' + total + '</b><span>문항</span></div>' +
          '<div class="result-stat"><b>' + (state.scores.filter(function (s) { return s.pass; }).length) + '</b><span>누적 합격</span></div>' +
        '</div>' +
        '<div class="result-actions">' +
          '<button type="button" class="btn btn-primary" data-action="retry-same">같은 방식으로 재응시</button>' +
          reBtn +
          '<button type="button" class="btn btn-outline" data-action="new-quiz">문항 구성 다시 선택</button>' +
          '<button type="button" class="btn btn-outline" data-go="tbm">TBM 체크리스트</button>' +
        '</div>' +
        wrongHtml +
      '</div>';
  }

  /* ── TBM 체크리스트 ────────────────────────────────── */
  function tbmCheckedCount() {
    var n = 0;
    Object.keys(state.tbm).forEach(function (id) {
      if (state.tbm[id]) n += 1;
    });
    return n;
  }

  function updateTbmStatus() {
    var done = tbmCheckedCount();
    var status = document.getElementById('tbm-status');
    var tail = done === TBM_TOTAL
      ? '모든 항목을 확인했습니다. TBM 공유 후 작업을 시작하세요.'
      : (done === 0 ? '항목을 누르면 점검 완료로 표시됩니다.' : '남은 항목 ' + (TBM_TOTAL - done) + '개');
    status.innerHTML = '' +
      '<span class="tbm-count">' + done + ' / ' + TBM_TOTAL + ' 점검 완료</span>' +
      '<span class="bar"><span class="bar-fill" style="width:' + pct(done, TBM_TOTAL) + '%"></span></span>' +
      '<span class="quiz-hint">' + tail + '</span>';
  }

  function renderTbm() {
    document.getElementById('tbm-total').textContent = String(TBM_TOTAL);
    var html = TBM_GROUPS.map(function (group) {
      var items = group.items.map(function (item) {
        var checked = !!state.tbm[item.id];
        return '<label class="tbm-item">' +
          '<input type="checkbox" data-tbm="' + item.id + '"' + (checked ? ' checked' : '') + '>' +
          '<span class="cbox" aria-hidden="true"></span>' +
          '<span class="tbm-text">' + esc(item.text) + '</span>' +
          '</label>';
      }).join('');
      var groupDone = group.items.filter(function (item) { return !!state.tbm[item.id]; }).length;
      return '<section class="tbm-group">' +
        '<div class="tbm-group-head">' +
          '<span aria-hidden="true">' + (group.icon || '•') + '</span>' +
          '<h3>' + esc(group.title) + '</h3>' +
          '<span class="g-count">' + groupDone + '/' + group.items.length + '</span>' +
        '</div>' +
        '<div class="tbm-items">' + items + '</div>' +
      '</section>';
    }).join('');
    document.getElementById('tbm-root').innerHTML = html;
    updateTbmStatus();
  }

  /* ── 이벤트 ────────────────────────────────────────── */
  document.addEventListener('click', function (event) {
    if (!event.target || typeof event.target.closest !== 'function') return;
    var viewBtn = event.target.closest('[data-view]');
    if (viewBtn) {
      setView(viewBtn.getAttribute('data-view'));
      return;
    }

    var goBtn = event.target.closest('[data-go]');
    if (goBtn) {
      setView(goBtn.getAttribute('data-go'));
      return;
    }

    var filterBtn = event.target.closest('[data-filter]');
    if (filterBtn) {
      state.filter = filterBtn.getAttribute('data-filter');
      renderLearn();
      return;
    }

    var actionBtn = event.target.closest('[data-action]');
    if (!actionBtn) return;
    var action = actionBtn.getAttribute('data-action');

    if (action === 'toggle-case') {
      var card = actionBtn.closest('.case-card');
      if (!card) return;
      var id = card.getAttribute('data-id');
      state.openCases[id] = !state.openCases[id];
      renderLearn();
      return;
    }

    if (action === 'toggle-learned') {
      var cardDone = actionBtn.closest('.case-card');
      if (!cardDone) return;
      toggleLearned(cardDone.getAttribute('data-id'));
      return;
    }

    if (action === 'jump-case') {
      jumpToCase(actionBtn.getAttribute('data-id'));
      return;
    }

    if (action === 'start-quiz') {
      startQuiz(actionBtn.getAttribute('data-mode'));
      return;
    }

    if (action === 'answer') {
      answerQuestion(parseInt(actionBtn.getAttribute('data-index'), 10));
      return;
    }

    if (action === 'next-question') {
      nextQuestion();
      return;
    }

    if (action === 'retry-same') {
      var mode = state.quiz ? state.quiz.mode : 'random10';
      state.quiz = null;
      startQuiz(mode === 'all' ? 'all' : 'random10');
      return;
    }

    if (action === 'retry-wrong') {
      var wrongQuestions = state.quiz.answers.filter(function (a) { return !a.correct; }).map(function (a) {
        for (var i = 0; i < QUIZ.length; i += 1) { if (QUIZ[i].id === a.qid) return QUIZ[i]; }
        return null;
      }).filter(function (q) { return !!q; });
      state.quiz = null;
      if (wrongQuestions.length) startQuiz('wrong', wrongQuestions);
      else renderQuizStart();
      return;
    }

    if (action === 'new-quiz') {
      state.quiz = null;
      renderQuizStart();
      return;
    }
  });

  document.addEventListener('change', function (event) {
    if (!event.target || typeof event.target.closest !== 'function') return;
    var box = event.target.closest('[data-tbm]');
    if (!box) return;
    var id = box.getAttribute('data-tbm');
    if (box.checked) state.tbm[id] = true;
    else delete state.tbm[id];
    writeStore(KEY.tbm, state.tbm);

    var group = box.closest('.tbm-group');
    if (group) {
      var boxes = group.querySelectorAll('[data-tbm]');
      var done = 0;
      for (var i = 0; i < boxes.length; i += 1) { if (boxes[i].checked) done += 1; }
      var counter = group.querySelector('.g-count');
      if (counter) counter.textContent = done + '/' + boxes.length;
    }
    updateTbmStatus();
  });

  document.getElementById('tbm-reset').addEventListener('click', function () {
    if (tbmCheckedCount() === 0) return;
    var ok = window.confirm('TBM 체크리스트의 모든 체크를 지웁니다. 새 작업을 시작할 때만 초기화하세요.');
    if (!ok) return;
    state.tbm = {};
    writeStore(KEY.tbm, {});
    renderTbm();
  });

  /* ── 시작 ──────────────────────────────────────────── */
  function boot() {
    if (!Array.isArray(CASES) || !CASES.length) {
      document.getElementById('case-list').innerHTML = '<p class="empty">사례 데이터를 불러오지 못했습니다. data.js 파일을 확인해 주세요.</p>';
      return;
    }
    var initial = (window.location.hash || '').replace('#', '');
    var allowed = ['home', 'learn', 'quiz', 'tbm'];
    renderHome();
    setView(allowed.indexOf(initial) !== -1 ? initial : 'home');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
