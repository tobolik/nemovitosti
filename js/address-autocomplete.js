// js/address-autocomplete.js – našeptávač adres (ulice, PSČ, město)

const AddressAutocomplete = (() => {
    let debounceTimer = null;
    const DEBOUNCE_MS = 350;
    const MIN_CHARS = 2;

    function create(inputId, options = {}) {
        const input = document.getElementById(inputId);
        if (!input) return;

        let container = input.parentNode;
        let dropdown = null;
        let selectedIndex = -1;

        function hideDropdown() {
            if (dropdown) {
                dropdown.remove();
                dropdown = null;
            }
            selectedIndex = -1;
        }

        function showDropdown(items) {
            hideDropdown();
            if (!items || !items.length) return;

            dropdown = document.createElement('div');
            dropdown.className = 'address-autocomplete';
            dropdown.setAttribute('role', 'listbox');

            items.forEach((item, i) => {
                const div = document.createElement('div');
                div.className = 'address-autocomplete-item';
                div.setAttribute('role', 'option');
                div.textContent = item.label || item.address;
                div.dataset.address = item.address || item.label;
                div.dataset.postcode = item.postcode || '';
                div.addEventListener('click', () => selectItem(item));
                div.addEventListener('mouseenter', () => { selectedIndex = i; highlight(); });
                dropdown.appendChild(div);
            });

            container.style.position = 'relative';
            container.appendChild(dropdown);
            selectedIndex = 0;
            highlight();
        }

        function highlight() {
            if (!dropdown) return;
            const items = dropdown.querySelectorAll('.address-autocomplete-item');
            items.forEach((el, i) => el.classList.toggle('active', i === selectedIndex));
        }

        function selectItem(item) {
            input.value = item.address || item.label;
            hideDropdown();
            input.dispatchEvent(new Event('change', { bubbles: true }));
            if (options.onSelect) options.onSelect(item);
        }

        async function fetchSuggestions(q) {
            if (q.length < MIN_CHARS) { hideDropdown(); return; }
            try {
                const res = await fetch('/api/address-suggest.php?q=' + encodeURIComponent(q) + '&limit=5');
                const data = await res.json();
                const items = data && data.data ? data.data : (Array.isArray(data) ? data : []);
                showDropdown(items);
            } catch (e) {
                hideDropdown();
            }
        }

        function onInput() {
            clearTimeout(debounceTimer);
            const q = input.value.trim();
            if (q.length < MIN_CHARS) { hideDropdown(); return; }
            debounceTimer = setTimeout(() => fetchSuggestions(q), DEBOUNCE_MS);
        }

        function onKeydown(e) {
            if (e.key === 'ArrowDown' && !dropdown) {
                e.preventDefault();
                const q = input.value.trim();
                if (q.length >= MIN_CHARS) fetchSuggestions(q);
                return;
            }
            if (!dropdown) return;
            const items = dropdown.querySelectorAll('.address-autocomplete-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                highlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                highlight();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (items[selectedIndex]) selectItem({ address: items[selectedIndex].dataset.address, label: items[selectedIndex].textContent, postcode: items[selectedIndex].dataset.postcode });
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideDropdown();
            }
        }

        function onClickOutside(e) {
            if (dropdown && !container.contains(e.target)) hideDropdown();
        }

        input.addEventListener('input', onInput);
        input.addEventListener('keydown', onKeydown);
        input.addEventListener('focus', () => { if (input.value.trim().length >= MIN_CHARS) onInput(); });
        document.addEventListener('click', onClickOutside);
    }

    return { create };
})();
