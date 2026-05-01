class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector("details");
    this.content =
      this.mainDetailsToggle.querySelector("summary").nextElementSibling;

    // this.mainDetailsToggle.addEventListener(
    //   "focusout",
    //   this.onFocusOut.bind(this)
    // );
    this.mainDetailsToggle.addEventListener("toggle", this.onToggle.bind(this));
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute("open")) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute("open");
    this.mainDetailsToggle
      .querySelector("summary")
      .setAttribute("aria-expanded", false);
  }
}

customElements.define("details-disclosure", DetailsDisclosure);
if (!customElements.get("share-button")) {
  customElements.define(
    "share-button",
    class ShareButton extends DetailsDisclosure {
      constructor() {
        super();

        this.elements = {
          shareButton: this.querySelector("button"),
          shareSummary: this.querySelector("summary"),
          closeButton: this.querySelector(".share-button__close"),
          successMessage: this.querySelector('[id^="ShareMessage"]'),
          urlInput: this.querySelector("input"),
        };
        this.urlToShare = this.elements.urlInput
          ? this.elements.urlInput.value
          : document.location.href;

        if (navigator.share) {
          this.mainDetailsToggle.setAttribute("hidden", "");
          this.elements.shareButton.classList.remove("hidden");
          this.elements.shareButton.addEventListener("click", () => {
            navigator.share({ url: this.urlToShare, title: document.title });
          });
        } else {
          this.mainDetailsToggle.addEventListener(
            "toggle",
            this.toggleDetails.bind(this)
          );
          this.mainDetailsToggle
            .querySelector(".share-button__copy")
            .addEventListener("click", this.copyToClipboard.bind(this));
          this.mainDetailsToggle
            .querySelector(".share-button__close")
            .addEventListener("click", this.close.bind(this));
        }
      }

      toggleDetails() {
        if (!this.mainDetailsToggle.open) {
          this.elements.successMessage.classList.add("hidden");
          this.elements.successMessage.textContent = "";
          this.elements.closeButton.classList.add("hidden");
          this.elements.shareSummary.focus();
        } else {
          this.elements.closeButton.classList.remove("hidden");
        }
      }

      copyToClipboard() {
        navigator.clipboard.writeText(this.elements.urlInput.value).then(() => {
          this.elements.successMessage.classList.remove("hidden");
          this.elements.successMessage.textContent =
            window.accessibilityStrings.shareSuccess;
          this.elements.closeButton.classList.remove("hidden");
          this.elements.closeButton.focus();
        });
      }

      updateUrl(url) {
        this.urlToShare = url;
        this.elements.urlInput.value = url;
      }
    }
  );
}
