function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = "json") {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `application/${type}`,
    },
  };
}

// Scroll lock manager with reference counting
const scrollLockManager = {
  lockedBy: new Set(),
  scrollY: 0,

  lock(element) {
    // Store scroll position on first lock
    if (this.lockedBy.size === 0) {
      this.scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${this.scrollY}px`;
      document.body.style.width = "100%";
    }

    // Add element to locked set
    this.lockedBy.add(element);
    element.dataset.scrollY = this.scrollY;
  },

  unlock(element) {
    // Remove element from locked set
    this.lockedBy.delete(element);

    // Only unlock body if no more elements need lock
    if (this.lockedBy.size === 0) {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo({
        behavior: "instant",
        left: 0,
        top: this.scrollY,
      });
      console.log('Body scroll unlocked');
    }
  },

  isLocked() {
    return this.lockedBy.size > 0;
  },

  clear() {
    this.lockedBy.clear();
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.width = "";
  }
};

// Maintain backward compatibility
function lockScrollForThis(element) {
  scrollLockManager.lock(element);
}

function unlockScrollForThis(element) {
  scrollLockManager.unlock(element);
}

// fix childMenu positions
const fixChildMenuPositions = () => {
  const viewport = window.visualViewport;
  if (viewport && typeof viewport.scale === "number" && Math.abs((viewport.scale || 1) - 1) > 0.001) {
    return;
  }
  const childMenus = document.querySelectorAll("._headerChildMenu");
  const isRTL = document.body.style.direction === "rtl";
  const windowWidth = window.innerWidth;

  childMenus.forEach((childMenu) => {
    let isOffScreen = false;
    const childMenuRect = childMenu.getBoundingClientRect();

    // Check if the child menu itself is off-screen
    if (isRTL) {
      isOffScreen = childMenuRect.left < 0;
    } else {
      isOffScreen = childMenuRect.right > windowWidth;
    }

    // If child menu is not off-screen, check its grandchild menus
    if (!isOffScreen) {
      const grandChildMenus = childMenu.querySelectorAll(
        "._headerGrandChildMenu",
      );
      grandChildMenus.forEach((grandChildMenu) => {
        // Temporarily make the grandchild menu visible for accurate measurements
        const originalDisplay = grandChildMenu.style.display;
        grandChildMenu.style.display = "block";
        grandChildMenu.style.visibility = "hidden";

        const grandChildMenuRect = grandChildMenu.getBoundingClientRect();

        // Restore original display
        grandChildMenu.style.display = originalDisplay;
        grandChildMenu.style.visibility = "";

        if (isRTL) {
          if (grandChildMenuRect.left < 0) isOffScreen = true;
        } else {
          if (grandChildMenuRect.right > windowWidth) isOffScreen = true;
        }
      });
    }

    if (isOffScreen) {
      childMenu.setAttribute("data-offscreen", "true");
    } else {
      childMenu.removeAttribute("data-offscreen");
    }
  });
};

window.addEventListener("resize", debounce(fixChildMenuPositions, 150));
window.addEventListener("DOMContentLoaded", fixChildMenuPositions);


function initImageTextSliders() {
  document.querySelectorAll('.js-image-text-toggle').forEach((el) => {
    el.addEventListener('click', () => {
      el.classList.toggle('active');
    });
  });
}

['DOMContentLoaded', 'shopify:section:load'].forEach((event) => {
  document.addEventListener(event, initImageTextSliders);
});

const normalize = (str) => str?.toString().trim().toLowerCase() || '';