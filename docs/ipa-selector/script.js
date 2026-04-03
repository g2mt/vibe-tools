document.querySelectorAll('a.phoneme').forEach(anchor => {
    anchor.href = '#';
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        
        const text = anchor.textContent;
        navigator.clipboard.writeText(text);

        anchor.style.transform = 'translateY(-5px)';
        setTimeout(() => {
            anchor.style.transform = 'translateY(0)';
        }, 100);
    });
});
