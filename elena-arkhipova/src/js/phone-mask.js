export function formatRussianPhone(value) {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (/^[78]/.test(digits)) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  let result = '+7';
  if (digits.length) result += ` (${digits.slice(0, 3)}`;
  if (digits.length >= 3) result += ')';
  if (digits.length > 3) result += ` ${digits.slice(3, 6)}`;
  if (digits.length > 6) result += `-${digits.slice(6, 8)}`;
  if (digits.length > 8) result += `-${digits.slice(8, 10)}`;
  return result;
}

export function setupPhoneMask(input) {
  input.inputMode = 'tel';
  input.maxLength = 30; // Allow unformatted pasted input before normalization.
  input.addEventListener('beforeinput', event => {
    if (!['deleteContentBackward', 'deleteContentForward'].includes(event.inputType)
        || input.selectionStart !== input.selectionEnd) return;
    let position = input.selectionStart;
    const backward = event.inputType === 'deleteContentBackward';
    let target = backward ? position - 1 : position;
    while (target >= 2 && target < input.value.length && /\D/.test(input.value[target])) target += backward ? -1 : 1;
    if (target < 2) {
      event.preventDefault();
      if (input.value === '+7') { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
      return;
    }
    if (target >= input.value.length) return;
    event.preventDefault();
    input.value = input.value.slice(0, target) + input.value.slice(target + 1);
    position = backward ? target : position;
    input.setSelectionRange(position, position);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const update = () => {
    const old = input.value;
    const position = input.selectionStart ?? old.length;
    const end = position === old.length;
    let count = old.slice(0, position).replace(/\D/g, '').length;
    if (old && !/^[78]/.test(old.replace(/\D/g, ''))) count++;
    input.value = formatRussianPhone(old);
    let cursor = 0;
    while (cursor < input.value.length && count > 0) {
      if (/\d/.test(input.value[cursor])) count--;
      cursor++;
    }
    if (end) cursor = input.value.length;
    input.setSelectionRange(cursor, cursor);
  };
  input.addEventListener('input', update);
  input.addEventListener('change', update);
}
