// ==UserScript==
// @name         WeLearn自动填答案
// @namespace    local.sflep.autofill
// @version      3.0
// @description  读取 data-solution 自动填写选择题、填空题、匹配题、翻译题；只显示一个按钮；不自动提交
// @match        *://welearn.sflep.com/student/StudyCourse.aspx*
// @match        *://centercourseware.sflep.com/*
// @match        *://courseres.sflep.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const MSG_FILL = 'SFLEP_AUTO_FILL_ANSWERS_V3';
  const BTN_ID = 'sflep-auto-fill-btn-v3';

  function isTopPage() {
    return window.top === window.self;
  }

  function isOuterStudyPage() {
    return isTopPage() && !!document.querySelector('#contentFrame');
  }

  function isQuestionPage() {
    return !!document.querySelector(
      '[data-solution], [data-controltype="choice"], [data-controltype="fillinglong"], textarea'
    );
  }

  function fire(el, type) {
    if (!el) return;
    el.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function setValue(el, value) {
    if (!el || value == null || value === '') return false;

    const oldReadonly = el.readOnly;
    const oldDisabled = el.disabled;

    el.readOnly = false;
    el.disabled = false;

    el.focus();

    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');

    if (desc && desc.set) {
      desc.set.call(el, value);
    } else {
      el.value = value;
    }

    fire(el, 'input');
    fire(el, 'change');
    fire(el, 'keyup');
    fire(el, 'blur');

    el.readOnly = oldReadonly;
    el.disabled = oldDisabled;

    return true;
  }

  function setEditable(el, value) {
    if (!el || !value) return false;

    el.focus();
    el.innerText = value;
    el.textContent = value;

    fire(el, 'input');
    fire(el, 'change');
    fire(el, 'keyup');
    fire(el, 'blur');

    return true;
  }

  function getText(el) {
    return el ? (el.innerText || el.textContent || '').trim() : '';
  }

  function getSolutionFromBox(box) {
    if (!box) return '';

    const direct = box.querySelector('input[data-solution], textarea[data-solution]');
    if (direct && direct.getAttribute('data-solution')) {
      return direct.getAttribute('data-solution').trim();
    }

    const result = box.querySelector('[data-itemtype="result"]');
    if (result && getText(result)) {
      return getText(result);
    }

    return '';
  }

  function fillChoices() {
    let count = 0;

    document.querySelectorAll('[data-controltype="choice"]').forEach(q => {
      const answerLi = q.querySelector('li[data-solution]');
      if (!answerLi) return;

      answerLi.click();

      const clickable = answerLi.querySelector('input, label, span');
      if (clickable) clickable.click();

      answerLi.classList.add('sflep-auto-filled');
      count++;
    });

    return count;
  }

  function fillInputs() {
    let count = 0;

    document.querySelectorAll('input[data-solution]').forEach(input => {
      const ans = input.getAttribute('data-solution');
      if (!ans) return;

      if (setValue(input, ans)) count++;

      const box = input.closest('[data-controltype]');
      if (box) {
        const myResult = box.querySelector('[data-itemtype="myresult"]');
        const matchingClick = box.querySelector('[data-itemtype="matching_click"]');

        if (myResult) myResult.innerText = ans;
        if (matchingClick) matchingClick.innerText = ans;
      }
    });

    return count;
  }

  function fillTextareas() {
    let count = 0;

    document.querySelectorAll('textarea[data-solution]').forEach(textarea => {
      const ans = textarea.getAttribute('data-solution');
      if (!ans) return;

      if (setValue(textarea, ans)) count++;
    });

    return count;
  }

  function fillLongAnswers() {
    let count = 0;

    document.querySelectorAll('[data-controltype="fillinglong"]').forEach(box => {
      const ans = getSolutionFromBox(box);
      if (!ans) return;

      let filled = false;

      const textarea = box.querySelector('textarea');
      if (textarea) {
        filled = setValue(textarea, ans);
      }

      if (!filled) {
        const editable = box.querySelector('[contenteditable="true"]');
        if (editable) filled = setEditable(editable, ans);
      }

      if (!filled) {
        const input = box.querySelector('input[type="text"]');
        if (input) filled = setValue(input, ans);
      }

      if (filled) count++;
    });

    return count;
  }

  function fillBigVisibleAreas() {
    let count = 0;

    document.querySelectorAll('.subjective, .filling_widthmax, .textarea_withoutborder').forEach(area => {
      const box = area.querySelector('[data-controltype="fillinglong"]');
      if (!box) return;

      const ans = getSolutionFromBox(box);
      if (!ans) return;

      const textarea = area.querySelector('textarea');
      const editable = area.querySelector('[contenteditable="true"]');

      if (textarea && setValue(textarea, ans)) {
        count++;
      } else if (editable && setEditable(editable, ans)) {
        count++;
      }
    });

    return count;
  }

  function fillAllInCurrentDocument() {
    const choiceCount = fillChoices();
    const inputCount = fillInputs();
    const textareaCount = fillTextareas();
    const longCount = fillLongAnswers();
    const bigAreaCount = fillBigVisibleAreas();

    return {
      choiceCount,
      inputCount,
      textareaCount,
      longCount,
      bigAreaCount,
      total: choiceCount + inputCount + textareaCount + longCount + bigAreaCount
    };
  }

  function showResult(stat) {
    alert(
      '填充完成：\n' +
      `选择题：${stat.choiceCount}\n` +
      `填空/匹配：${stat.inputCount}\n` +
      `普通 textarea：${stat.textareaCount}\n` +
      `翻译/主观题：${stat.longCount + stat.bigAreaCount}\n\n` +
      '不会自动提交，请检查后手动提交。'
    );
  }

  function createTopButton() {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = '自动填答案';

    Object.assign(btn.style, {
      position: 'fixed',
      right: '78px',
      top: '90px',
      zIndex: '999999',
      padding: '10px 16px',
      border: 'none',
      borderRadius: '8px',
      background: '#1677ff',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,.22)',
      userSelect: 'none'
    });

    btn.addEventListener('click', () => {
      const frame = document.querySelector('#contentFrame');

      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: MSG_FILL }, '*');
      } else {
        const stat = fillAllInCurrentDocument();
        showResult(stat);
      }
    });

    document.body.appendChild(btn);
  }

  function createInnerButtonIfStandalone() {
    if (window.top !== window.self) return;
    if (!isQuestionPage()) return;
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.textContent = '自动填答案';

    Object.assign(btn.style, {
      position: 'fixed',
      right: '24px',
      top: '90px',
      zIndex: '999999',
      padding: '10px 16px',
      border: 'none',
      borderRadius: '8px',
      background: '#1677ff',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,.22)',
      userSelect: 'none'
    });

    btn.addEventListener('click', () => {
      const stat = fillAllInCurrentDocument();
      showResult(stat);
    });

    document.body.appendChild(btn);
  }

  // iframe 内部接收外层按钮指令
  window.addEventListener('message', e => {
    if (!e.data || e.data.type !== MSG_FILL) return;

    const stat = fillAllInCurrentDocument();
    showResult(stat);
  });

  window.addEventListener('load', () => {
    setTimeout(() => {
      if (isOuterStudyPage()) {
        createTopButton();
        return;
      }

      // 如果单独打开的是题目页，才显示按钮
      createInnerButtonIfStandalone();
    }, 800);
  });
})();
