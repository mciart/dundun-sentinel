import { useEffect, useRef, useState } from 'react';


export default function StarryBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const starsRef = useRef([]);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newIsDark = document.documentElement.classList.contains('dark');
      setIsDark(newIsDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isDark) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;
    let starCount = Math.floor(0.216 * width);
    const speed = 0.05;

    const colors = {
      giant: '180,184,240',
      normal: '226,225,142',
      comet: '226,225,224'
    };

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      starCount = Math.floor(0.216 * width);
      canvas.width = width;
      canvas.height = height;
    };

    const random = (min, max) => Math.random() * (max - min) + min;
    const chance = (percentage) => Math.floor(Math.random() * 1000) + 1 < 10 * percentage;

    let allowComets = false;
    setTimeout(() => {
      allowComets = true;
    }, 50);

    class Star {
      constructor() {
        this.reset();
      }

      reset() {
        this.giant = chance(3);
        this.comet = !this.giant && allowComets && chance(10);
        this.x = random(0, width - 10);
        this.y = random(0, height);
        this.r = random(1.1, 2.6);
        this.dx = random(speed, 6 * speed) + (this.comet ? speed * random(50, 120) : 0) + 2 * speed;
        this.dy = -random(speed, 6 * speed) - (this.comet ? speed * random(50, 120) : 0);
        this.fadingOut = null;
        this.fadingIn = true;
        this.opacity = 0;
        this.opacityTresh = random(0.2, 1 - 0.4 * (this.comet ? 1 : 0));
        this.do = random(0.0005, 0.002) + 0.001 * (this.comet ? 1 : 0);
      }

      fadeIn() {
        if (this.fadingIn) {
          this.fadingIn = !(this.opacity > this.opacityTresh);
          this.opacity += this.do;
        }
      }

      fadeOut() {
        if (this.fadingOut) {
          this.fadingOut = !(this.opacity < 0);
          this.opacity -= this.do / 2;
          if (this.x > width || this.y < 0) {
            this.fadingOut = false;
            this.reset();
          }
        }
      }

      draw() {
        ctx.beginPath();

        if (this.giant) {
          ctx.fillStyle = `rgba(${colors.giant},${this.opacity})`;
          ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI, false);
        } else if (this.comet) {
          ctx.fillStyle = `rgba(${colors.comet},${this.opacity})`;
          ctx.arc(this.x, this.y, 1.5, 0, 2 * Math.PI, false);
          
          for (let i = 0; i < 30; i++) {
            ctx.fillStyle = `rgba(${colors.comet},${this.opacity - this.opacity / 20 * i})`;
            ctx.rect(
              this.x - this.dx / 4 * i,
              this.y - this.dy / 4 * i - 2,
              2,
              2
            );
            ctx.fill();
          }
        } else {
          ctx.fillStyle = `rgba(${colors.normal},${this.opacity})`;
          ctx.rect(this.x, this.y, this.r, this.r);
        }

        ctx.closePath();
        ctx.fill();
      }

      move() {
        this.x += this.dx;
        this.y += this.dy;
        
        if (this.fadingOut === false) {
          this.reset();
        }
        
        if (this.x > width - width / 4 || this.y < 0) {
          this.fadingOut = true;
        }
      }
    }

    const initStars = () => {
      starsRef.current = [];
      for (let i = 0; i < starCount; i++) {
        starsRef.current[i] = new Star();
        starsRef.current[i].reset();
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      for (let i = 0; i < starsRef.current.length; i++) {
        const star = starsRef.current[i];
        star.move();
        star.fadeIn();
        star.fadeOut();
        star.draw();
      }
    };

    const animate = () => {
      if (isDark) {
        draw();
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    resizeCanvas();
    initStars();
    animate();

    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ 
        opacity: isDark ? 0.8 : 0,
        zIndex: 9999,
        transition: 'opacity 0.3s ease'
      }}
    />
  );
}
