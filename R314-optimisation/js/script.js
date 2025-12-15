(function(){
  function runHeavyWorkAsync(calculationCount) {
    setTimeout(() => {
      const waste = [];
      for (let i = 0; i < calculationCount; i++) {
        waste.push(Math.random() * i);
      }
      window.__waste = waste;

      requestAnimationFrame(function() {
        const t0 = performance.now();
        const duration = performance.now() - t0;
      });

    }, 0);
  }

  runHeavyWorkAsync(200000);

  window.addEventListener('load', function(){
    const imgs = document.querySelectorAll('.card img');
    imgs.forEach(img => { 
      if (img.complete) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', ()=> img.classList.add('loaded'));
      }
    });
  });
})();
