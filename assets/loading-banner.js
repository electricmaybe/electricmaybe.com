if (!customElements.get('loading-banner')) {
class LoadingBanner extends HTMLElement {
  constructor() {
    super();
    this.progress = 0;
    this.targetProgress = 0;
    this.isAnimating = false;
    this.animationId = null;
    this.timeoutId = null;
    this.maxLoadingTime = 4000; // 8 seconds max loading time
    
    this.init();
  }

  init() {
    // Create progress bar element
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'h-full';
    this.progressBar.style.width = '0%';
    this.appendChild(this.progressBar);

    // Set initial color
    this.updateColor();

    // Start with 0% progress
    this.setProgress(0);

    // Listen for page load events
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for link clicks to show loading bar
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (link && link.href && !link.href.startsWith('#')) {
        this.fakeLoadingSteps();
      }
    });

    // Listen for form submissions
    document.addEventListener('submit', () => {
      this.fakeLoadingSteps();
    });

    // Handle back/forward navigation
    window.addEventListener('popstate', () => {
      this.fakeLoadingSteps();
    });

    // Listen for custom navigation events
    document.addEventListener('navigation:start', () => {
      this.fakeLoadingSteps();
    });

    document.addEventListener('navigation:complete', () => {
      // Clear timeout since navigation completed normally
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      
      this.setProgress(100);
      
      // Reset to 0 after completion (no animation)
      setTimeout(() => {
        // Cancel any ongoing animation
        if (this.animationId) {
          cancelAnimationFrame(this.animationId);
          this.animationId = null;
        }
        this.isAnimating = false;
        
        this.progress = 0;
        this.targetProgress = 0;
        this.progressBar.style.width = '0%';
      }, 1000);
    });
  }

            updateColor() {
    const color = this.dataset.color || 'bg-subtle';
    this.progressBar.className = `h-full rounded-r-full ${color}`;
  }

  fakeLoadingSteps() {
    // Clear any existing fake step timers and timeout
    if (this.fakeStepTimers) {
      this.fakeStepTimers.forEach(timer => clearTimeout(timer));
    }
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.fakeStepTimers = [];
    
    // Start at 10%
    this.setProgress(10);
    
    // Fake intermediate steps with controlled progression
    this.fakeStepTimers.push(
      setTimeout(() => this.setProgress(25), 200),
      setTimeout(() => this.setProgress(40), 400),
      setTimeout(() => this.setProgress(60), 600),
      setTimeout(() => this.setProgress(75), 800),
      setTimeout(() => this.setProgress(90), 1000)
    );
    
    // Set timeout to auto-complete if stuck at 90%
    this.timeoutId = setTimeout(() => {
      if (this.progress >= 85) { // If still loading after max time
        this.completeLoading();
      }
    }, this.maxLoadingTime);
  }

  // Manual control methods for AJAX operations
  startLoading() {
    this.fakeLoadingSteps();
  }

  completeLoading() {
    // Clear timeout since we're completing manually
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    this.setProgress(100);
    
    // Reset to 0 after completion (no animation)
    setTimeout(() => {
      // Cancel any ongoing animation
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this.isAnimating = false;
      
      this.progress = 0;
      this.targetProgress = 0;
      this.progressBar.style.width = '0%';
    }, 1000);
  }

  resetLoading() {
    // Clear timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    // Cancel any ongoing animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.isAnimating = false;
    
    this.progress = 0;
    this.targetProgress = 0;
    this.progressBar.style.width = '0%';
  }

  setProgress(target) {
    // If going backwards (smaller value), make it instant
    if (target < this.progress) {
      this.progress = target;
      this.targetProgress = target;
      this.progressBar.style.width = `${target}%`;
      
      // Cancel any ongoing animation
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
      }
      this.isAnimating = false;
      return;
    }
    
    this.targetProgress = target;
    
    if (!this.isAnimating) {
      this.animateProgress();
    }
  }

  animateProgress() {
    this.isAnimating = true;
    
    const animate = () => {
      const diff = this.targetProgress - this.progress;
      const step = diff * 0.1; // Smooth easing
      
      if (Math.abs(diff) < 0.5) {
        this.progress = this.targetProgress;
        this.progressBar.style.width = `${this.progress}%`;
        this.isAnimating = false;
        return;
      }
      
      this.progress += step;
      this.progressBar.style.width = `${this.progress}%`;
      
      this.animationId = requestAnimationFrame(animate);
    };
    
    this.animationId = requestAnimationFrame(animate);
  }

  disconnectedCallback() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Clear timeout timer
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    
    // Clean up fake step timers
    if (this.fakeStepTimers) {
      this.fakeStepTimers.forEach(timer => clearTimeout(timer));
      this.fakeStepTimers = [];
    }
  }
}

  customElements.define('loading-banner', LoadingBanner);
}