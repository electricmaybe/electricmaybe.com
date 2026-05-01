class RevealStack extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    document.fonts.ready.then(() => {
      this.init();
    });
  }

  init() {
    const children = Array.from(this.children);

    // Use reduce to keep track of total lines processed
    children.reduce((totalLines, child, index) => {
      // Only split text if the element has data-split="true"
      if (child.hasAttribute('data-split') && child.textContent.trim()) {
        const splitText = new SplitText(child, {
          type: "lines",
          linesClass: "line line++",
          onSplit: (self) => {
            // Wrap each line in a div for better control
            self.lines.forEach(line => {
              line.classList.add('overflow-hidden');
              const wrapper = document.createElement('div');
              wrapper.classList.add('overflow-hidden');
              line.parentNode.insertBefore(wrapper, line);
              wrapper.appendChild(line);
            });

            // Animate each line with stagger, adding delay based on total lines processed
            gsap.from(self.lines, {
              duration: 0.8,
              y: '100%',
              opacity: 0,
              ease: 'power4.out',
              stagger: 0.15,
              delay: totalLines * 0.15,
              scrollTrigger: {
                trigger: this,
                start: 'top 80%',
                once: true
              },
              onComplete: () => {
                // Revert split text and remove wrappers
                // self.revert();
                // Remove overflow-hidden class from the original element
                child.classList.remove('overflow-hidden');
              }
            });

            // Store the split text instance for cleanup
            child._splitText = self;
          }
        });


        // Return updated total lines count
        return totalLines + splitText.lines.length;
      } else {
        // For non-split elements, wrap them in a container for overflow control
        // child has margins, move the margins to the wrapper
        const wrapper = document.createElement('div');
        const innerWrapper = document.createElement('div');
        wrapper.classList.add('overflow-hidden');
        wrapper.style.marginTop = window.getComputedStyle(child).marginTop;
        wrapper.style.marginBottom = window.getComputedStyle(child).marginBottom;
        wrapper.style.marginLeft = window.getComputedStyle(child).marginLeft;
        wrapper.style.marginRight = window.getComputedStyle(child).marginRight;
        child.style.margin = '0';
        child.parentNode.insertBefore(wrapper, child);
        innerWrapper.appendChild(child);
        wrapper.appendChild(innerWrapper);

        const y = child.dataset.y || '100%';

        // Animate with the same style as text, adding delay based on total lines processed
        gsap.from(innerWrapper, {
          duration: 0.8,
          y: y,
          opacity: 0,
          ease: 'power4.out',
          delay: totalLines * 0.15,
          scrollTrigger: {
            trigger: this,
            start: '10% 80%',
            once: true
          },
          onComplete: () => {
            // Move the child back to its original position
            const parent = wrapper.parentNode;
            parent.insertBefore(child, wrapper);
            // Restore original margins
            child.style.margin = '';
            // Remove the wrapper
            parent.removeChild(wrapper);
          }
        });

        // Return updated total lines count (increment by 1 for non-split elements)
        return totalLines + 1;
      }
    }, 0); // Start with 0 total lines

    // Clean up on unmount
    this.addEventListener('unmount', () => {
      children.forEach(child => {
        if (child._splitText) {
          child._splitText.revert();
        }
      });
    });
  }
}

customElements.define('reveal-stack', RevealStack);

class ParallaxBackground extends HTMLElement {
  constructor() {
    super();
    this.preloadBackgroundImage();
  }

  connectedCallback() {
    if (!this.closest('animated-section')) {
      this.init();
    }
  }

  preloadBackgroundImage() {
    // Get the background image URL from the style attribute
    const style = this.getAttribute('style');
    if (style && style.backgroundImage) {
      const imageUrl = style.backgroundImage.replace('url(', '').replace(')', '');
      if (imageUrl) {
        // Create link preload element for highest priority
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = imageUrl;
        link.fetchPriority = 'high';
        document.head.appendChild(link);

        // Also create an Image object as backup
        const img = new Image();
        img.src = imageUrl;
      }
    }
  }

  init() {
      let { backgroundSize = 100, y = 100 } = this.dataset;
      let fromBackgroundSize = '';
      let toBackgroundSize = '';

      // detect the aspect ratio of the background image and 'this's ratio and switch the place of 'auto' in the gsap set and gsap to.
      const backgroundImage = this.style.backgroundImage;
      const backgroundImageUrl = backgroundImage.replace('url(', '').replace(')', '');
      // Skip if no background image or regex match failed
      if (!backgroundImage || !backgroundImageUrl) {
        return;
      }

      const backgroundImageObj = new Image();
      backgroundImageObj.src = backgroundImageUrl;
      const backgroundImageAspectRatio = parseInt(this.dataset.width) / parseInt(this.dataset.height);
      const thisAspectRatio = this.offsetWidth / this.offsetHeight;
      if (backgroundImageAspectRatio > thisAspectRatio) {
        fromBackgroundSize = `auto ${backgroundSize}%`;
        toBackgroundSize = `auto 100%`;
      } else {
        fromBackgroundSize = `${backgroundSize}% auto`;
        toBackgroundSize = `100% auto`;
      }

      gsap.set(this, {
        backgroundPosition: `50% ${y}%`,
        backgroundSize: fromBackgroundSize
      })

      gsap.to(this, {
        backgroundPosition: '50% 50%',
        backgroundSize: toBackgroundSize,
        ease: 'none',
        scrollTrigger: {
          trigger: this,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
  }
}

customElements.define('parallax-background', ParallaxBackground);

class AnimatedSection extends HTMLElement {
  constructor() {
    super();
    this.parallaxItems = [];
  }

  connectedCallback() {
    ScrollTrigger.refresh();
    this.init();
  }

  init() {
    // Check if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.initParallaxItems();
    this.initParallaxBackground();
    this.initFadeInItems();
  }

  initFadeInItems() {
    this.fadeInItems = Array.from(this.querySelectorAll('fade-in-item'));
    this.fadeInItems.forEach(item => {
      // Set initial state
      gsap.set(item, {
        opacity: 0,
        y: 30
      });

      // Create scroll trigger
      ScrollTrigger.create({
        trigger: item,
        start: 'top 80%',
        onEnter: () => {
          gsap.to(item, {
            opacity: 1,
            y: 0,
            duration: 1.2,
            ease: 'power2.out'
          });
        },
        once: true
      });
    });
  }

  initParallaxBackground() {
    this.parallaxBackgrounds = Array.from(this.querySelectorAll('parallax-background'))

    this.parallaxBackgrounds.forEach(background => {
      background.init();
    });
  }

  initParallaxItems() {
    this.parallaxItems = Array.from(this.querySelectorAll('parallax-item'));

    this.parallaxItems.forEach(item => {
      const yPercent = parseInt(item.dataset.y) || 100;

      // Set initial position
      gsap.set(item, {
        yPercent: -yPercent
      });

      // Animate to final position
      gsap.to(item, {
        yPercent: yPercent,
        ease: 'power2.inOut',
        scrollTrigger: {
          trigger: this,
          start: 'top bottom',
          end: 'bottom top',
          scrub: item.dataset.scrub || 0.8,
        }
      });
    });
  }
}

class ParallaxItem extends HTMLElement {
  constructor() {
    super();
  }
}

customElements.define('animated-section', AnimatedSection);
customElements.define('parallax-item', ParallaxItem);


