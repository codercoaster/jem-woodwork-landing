(function () {
  'use strict';

  var root = document.documentElement;

  // Without GSAP the page stays complete: show everything and stop.
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var mark = document.querySelector('[data-hero="mark"]');
  var scorch = document.querySelector('[data-hero="scorch"]');
  var brand = document.querySelector('.brand');
  var title = document.querySelector('[data-hero="title"]');
  var titleScorch = document.querySelector('[data-hero="title-scorch"]');
  var lines = gsap.utils.toArray('[data-hero="line"]');
  var recesses = gsap.utils.toArray('[data-recess]');
  var contactTitle = document.querySelector('[data-contact-title]');


  // Work: a stack of prints on the bench. The top one is dragged or sent off; it goes to the bottom.
  var stack = (function (el) {
    if (!el) return null;

    var list = el.querySelector('.stack__prints');
    var prints = gsap.utils.toArray(el.querySelectorAll('[data-print]'));
    var bar = el.querySelector('[data-stack-bar]');
    var current = el.querySelector('[data-current]');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var n = prints.length;
    // Each print keeps its own tilt and offset, so its edge peeks out the same way every time.
    var REST = [-3, 2.5, -1.5, 4, -4, 1.5];
    var OFF = [[0, 0], [7, -5], [-9, 4], [11, 7], [-7, -8], [5, 9]];
    var order = prints.map(function (_, i) { return i; });
    var busy = false;
    var drag = null;

    el.classList.add('is-stack');
    bar.hidden = false;

    function pose(i, depth) {
      var k = i % REST.length;
      return depth === 0
        ? { x: 0, y: 0, rotation: REST[k] * 0.3 }
        : { x: OFF[k][0], y: OFF[k][1], rotation: REST[k] };
    }

    function layout(animate) {
      order.forEach(function (i, depth) {
        var p = prints[i];
        p.style.zIndex = n - depth;
        p.classList.toggle('is-top', depth === 0);
        if (depth === 0) { p.removeAttribute('inert'); p.removeAttribute('aria-hidden'); }
        else { p.setAttribute('inert', ''); p.setAttribute('aria-hidden', 'true'); }
        var to = pose(i, depth);
        if (animate) gsap.to(p, Object.assign({ duration: 0.45, ease: 'power3.out', overwrite: 'auto' }, to));
        else gsap.set(p, to);
      });
      current.textContent = order[0] + 1;
    }

    function unlockAfter(seconds) { gsap.delayedCall(seconds, function () { busy = false; }); }
    function width() { return list.offsetWidth; }

    // Reduced motion: no flying, just a short fade while the order changes.
    function fadeSwap(mutate) {
      gsap.to(list, { opacity: 0, duration: 0.1, ease: 'none', onComplete: function () {
        mutate();
        layout(false);
        gsap.to(list, { opacity: 1, duration: 0.1, ease: 'none', onComplete: function () { busy = false; } });
      } });
    }

    function sendBack(dir) {
      if (busy) return;
      busy = true;
      if (reduce.matches) { fadeSwap(function () { order.push(order.shift()); }); return; }
      var p = prints[order[0]];
      gsap.to(p, {
        x: dir * width() * 1.05, y: '+=12', rotation: dir * 14,
        duration: 0.32, ease: 'power2.in', overwrite: true,
        onComplete: function () {
          // Slide back in underneath everything.
          order.push(order.shift());
          layout(true);
          unlockAfter(0.25);
        }
      });
    }

    function bringFront() {
      if (busy) return;
      busy = true;
      if (reduce.matches) { fadeSwap(function () { order.unshift(order.pop()); }); return; }
      var p = prints[order[n - 1]];
      // Pulled out from under the pile, then laid on top.
      gsap.to(p, {
        x: -width() * 1.05, rotation: -14,
        duration: 0.26, ease: 'power2.in', overwrite: true,
        onComplete: function () {
          order.unshift(order.pop());
          layout(true);
          unlockAfter(0.3);
        }
      });
    }

    // Dragging the top print. A gesture that starts vertical is left to the page scroll.
    list.addEventListener('pointerdown', function (e) {
      if (busy || e.button > 0) return;
      var p = prints[order[0]];
      if (!p.contains(e.target)) return;
      drag = { p: p, id: e.pointerId, x0: e.clientX, y0: e.clientY, lastX: e.clientX, lastT: e.timeStamp, vx: 0, dx: 0, axis: null,
        base: pose(order[0], 0).rotation };
      if (e.pointerType === 'mouse') { list.setPointerCapture(e.pointerId); e.preventDefault(); }
    });

    list.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0;
      var dy = e.clientY - drag.y0;
      if (!drag.axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (drag.axis === 'y') { drag = null; return; }
        if (!list.hasPointerCapture(e.pointerId)) list.setPointerCapture(e.pointerId);
        drag.p.classList.add('is-dragging');
        gsap.killTweensOf(drag.p);
      }
      var dt = e.timeStamp - drag.lastT;
      if (dt > 0) drag.vx = (e.clientX - drag.lastX) / dt;
      drag.lastX = e.clientX;
      drag.lastT = e.timeStamp;
      drag.dx = dx;
      gsap.set(drag.p, { x: dx, y: dy * 0.25, rotation: drag.base + dx * 0.05 });
    });

    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      d.p.classList.remove('is-dragging');
      if (!d.axis) return;
      var flung = Math.abs(d.vx) > 0.6 && Math.sign(d.vx) === Math.sign(d.dx);
      if (Math.abs(d.dx) > width() * 0.22 || flung) {
        sendBack(d.dx < 0 ? -1 : 1);
      } else {
        gsap.to(d.p, { x: 0, y: 0, rotation: d.base, duration: 0.4, ease: 'power3.out' });
      }
    }
    list.addEventListener('pointerup', endDrag);
    list.addEventListener('pointercancel', endDrag);

    el.querySelector('[data-next]').addEventListener('click', function () { sendBack(1); });
    el.querySelector('[data-prev]').addEventListener('click', bringFront);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); sendBack(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); bringFront(); }
    });

    layout(false);

    return {
      list: list,
      // Prints are dealt onto the bench from the bottom of the pile up, then the top one nudges once.
      dealIn: function () {
        busy = true;
        var tl = gsap.timeline({ onComplete: function () { busy = false; } });
        order.slice().reverse().forEach(function (i, k) {
          var to = pose(i, n - 1 - k);
          tl.set(prints[i], { visibility: 'visible' }, k * 0.08)
            .fromTo(prints[i],
              { x: to.x, y: to.y - 30, rotation: to.rotation * 2.5, scale: 1.06 },
              { x: to.x, y: to.y, rotation: to.rotation, scale: 1, duration: 0.5, ease: 'power3.out' },
              k * 0.08)
            // A quick fade only, so overlapping prints never look see-through.
            .fromTo(prints[i], { opacity: 0 }, { opacity: 1, duration: 0.1, ease: 'none' }, k * 0.08);
        });
        var top = prints[order[0]];
        var base = pose(order[0], 0).rotation;
        tl.to(top, { x: 18, rotation: base + 2, duration: 0.25, ease: 'power2.out' }, '+=0.2')
          .to(top, { x: 0, rotation: base, duration: 0.45, ease: 'power3.out' });
      }
    };
  })(document.querySelector('[data-stack]'));

  var media = gsap.matchMedia();

  media.add('(prefers-reduced-motion: no-preference)', function () {
    // The iron presses down, the scorch flares, then settles into the wood.
    gsap.set([mark, scorch, title, titleScorch].concat(lines), { visibility: 'visible' });

    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .set(brand, { willChange: 'transform' }, 0)
      .fromTo(brand, { scale: 1.16, opacity: 0 }, { scale: 0.97, opacity: 1, duration: 0.32, ease: 'power3.in' }, 0.1)
      .to(brand, { scale: 1, duration: 0.28, ease: 'power2.out', clearProps: 'willChange' }, 0.42)
      .fromTo(scorch, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1.04, duration: 0.4 }, 0.42)
      .to(scorch, { opacity: 0.72, scale: 1, duration: 0.8, ease: 'power2.inOut' }, 0.82)
      // Title: the iron comes down a second time, just after the logo lands.
      .set(title, { willChange: 'transform' }, 0.7)
      .fromTo(title, { scale: 1.16, opacity: 0 }, { scale: 0.97, opacity: 1, duration: 0.32, ease: 'power3.in' }, 0.7)
      .to(title, { scale: 1, duration: 0.28, ease: 'power2.out', clearProps: 'willChange,transform' }, 1.02)
      .fromTo(titleScorch, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1.04, duration: 0.4 }, 1.02)
      .to(titleScorch, { opacity: 0.72, scale: 1, duration: 0.8, ease: 'power2.inOut' }, 1.42)
      // transition:none stops the button's CSS transform transition fighting the tween;
      // clearProps drops the leftover inline transform so .btn:active can scale again.
      .from(lines, { y: 14, opacity: 0, duration: 0.5, transition: 'none', clearProps: 'transform,transition' }, 1.25);

    // Recesses (service cards, contact panel): each is routed out of the wall in one left-to-right
    // pass, then whatever is burned into it darkens in. Once.
    // The clip reaches 5px past the box so the recess's outer edge shadows are cut in with it,
    // instead of popping in when the clip is cleared.
    ScrollTrigger.batch(recesses, {
      start: 'top 90%',
      once: true,
      onEnter: function (batch) {
        gsap.set(batch, { visibility: 'visible' });
        var tl = gsap.timeline();
        batch.forEach(function (recess, i) {
          var at = i * 0.15;
          tl.fromTo(recess,
            { clipPath: 'inset(-5px ' + (recess.offsetWidth + 5) + 'px -5px -5px)' },
            { clipPath: 'inset(-5px -5px -5px -5px)', duration: 0.5, ease: 'power2.inOut', clearProps: 'clipPath' },
            at);
          var marks = recess.querySelectorAll('[data-burn]');
          // Opacity only: these carry an SVG turbulence filter, which would re-render every frame if scaled.
          if (marks.length) {
            tl.to(marks, { opacity: 1, duration: 0.3, ease: 'power2.out', stagger: 0.04,
              onStart: function () { gsap.set(marks, { willChange: 'opacity' }); },
              onComplete: function () { gsap.set(marks, { clearProps: 'willChange' }); } },
              at + 0.3);
          }
        });
      }
    });

    // Contact title: no second iron strike, just the letters darkening and the scorch flaring once.
    if (contactTitle) {
      var contactScorch = contactTitle.querySelector('.hero__scorch');
      var contactText = contactTitle.querySelector('.burn');
      ScrollTrigger.create({
        trigger: contactTitle,
        start: 'top 75%',
        once: true,
        onEnter: function () {
          gsap.timeline()
            .to(contactText, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0)
            .fromTo(contactScorch, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1.04, duration: 0.4, ease: 'power3.out' }, 0.15)
            .to(contactScorch, { opacity: 0.72, scale: 1, duration: 0.8, ease: 'power2.inOut' }, 0.55);
        }
      });
    }

    if (stack) {
      ScrollTrigger.create({ trigger: stack.list, start: 'top 80%', once: true, onEnter: stack.dealIn });
    }
  });

  media.add('(prefers-reduced-motion: reduce)', function () {
    gsap.set([mark, scorch, title, titleScorch].concat(lines, recesses), { visibility: 'visible' });
    gsap.from([mark, title].concat(lines), { opacity: 0, duration: 0.3, ease: 'none' });
    gsap.set([scorch, titleScorch], { opacity: 0.72 });
  });
})();
