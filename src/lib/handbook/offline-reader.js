(() => {
  const root = document.querySelector(".book-reader");
  const pages = [...document.querySelectorAll("[data-page]")];
  const sources = [...document.querySelector("#sources").children];
  const byId = (id) => document.getElementById(id);
  const storage = "veyd:offline:" + root.dataset.storage;
  let page = 0,
    ref = 0,
    filtered = sources,
    hideTimer;
  const show = (index) => {
    page = Math.max(0, Math.min(pages.length - 1, index));
    pages.forEach((item, i) => {
      item.hidden = i !== page;
    });
    pages[page].querySelector(".book-page-scroll").scrollTop = 0;
    byId("page-selector").value = page;
    byId("previous").disabled = page === 0;
    byId("next").disabled = page === pages.length - 1;
    byId("reference-popup").hidden = true;
    try {
      localStorage.setItem(storage, String(page));
    } catch {
      /* file readers may disable storage */
    }
  };
  const updateReference = () => {
    ref = Math.max(0, Math.min(filtered.length - 1, ref));
    byId("reference-item").replaceChildren(
      ...(filtered[ref]
        ? [filtered[ref].cloneNode(true)]
        : [document.createTextNode("No matching sources.")]),
    );
    byId("reference-count").textContent = filtered.length
      ? `${ref + 1} of ${filtered.length} references`
      : "No references";
    byId("reference-previous").disabled = ref <= 0;
    byId("reference-next").disabled = ref >= filtered.length - 1;
  };
  const popup = (button) => {
    clearTimeout(hideTimer);
    const source = sources[Number(button.dataset.reference)];
    if (!source) return;
    byId("popup-content").replaceChildren(source.cloneNode(true));
    const rect = button.getBoundingClientRect();
    const panel = byId("reference-popup");
    panel.hidden = false;
    panel.style.left =
      Math.max(12, Math.min(rect.left, innerWidth - 332)) + "px";
    panel.style.top =
      Math.max(12, Math.min(rect.bottom + 8, innerHeight - 350)) + "px";
  };
  root.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.goto !== undefined) show(Number(target.dataset.goto));
    if (target.dataset.reference !== undefined) popup(target);
    if (target.dataset.figure !== undefined) {
      byId("figure-content").replaceChildren(
        target.querySelector("figure").cloneNode(true),
      );
      byId("figure-dialog").showModal();
    }
  });
  root.addEventListener("focusin", (event) => {
    if (event.target.matches("[data-reference]")) popup(event.target);
  });
  root.addEventListener("mouseover", (event) => {
    const button = event.target.closest("[data-reference]");
    if (button) popup(button);
  });
  root.addEventListener("mouseout", (event) => {
    if (event.target.closest("[data-reference]"))
      hideTimer = setTimeout(() => {
        byId("reference-popup").hidden = true;
      }, 180);
  });
  byId("reference-popup").onmouseenter = () => clearTimeout(hideTimer);
  byId("reference-popup").onfocusin = () => clearTimeout(hideTimer);
  byId("reference-popup").onfocusout = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget))
      hideTimer = setTimeout(() => {
        byId("reference-popup").hidden = true;
      }, 180);
  };
  byId("reference-popup").onmouseleave = () => {
    byId("reference-popup").hidden = true;
  };
  byId("close-popup").onclick = () => {
    byId("reference-popup").hidden = true;
  };
  byId("previous").onclick = () => show(page - 1);
  byId("next").onclick = () => show(page + 1);
  byId("page-selector").onchange = (event) => show(Number(event.target.value));
  byId("open-references").onclick = () => {
    byId("reference-popup").hidden = true;
    byId("explorer").hidden = false;
    updateReference();
    byId("reference-search").focus();
  };
  byId("close-explorer").onclick = () => {
    byId("explorer").hidden = true;
    byId("open-references").focus();
  };
  byId("reference-search").oninput = (event) => {
    filtered = sources.filter((source) =>
      source.textContent
        .toLowerCase()
        .includes(event.target.value.toLowerCase()),
    );
    ref = 0;
    updateReference();
  };
  byId("reference-previous").onclick = () => {
    ref--;
    updateReference();
  };
  byId("reference-next").onclick = () => {
    ref++;
    updateReference();
  };
  byId("close-figure").onclick = () => byId("figure-dialog").close();
  byId("print").onclick = () => window.print();
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      byId("reference-popup").hidden = true;
      byId("explorer").hidden = true;
    }
    if (
      event.target.closest("input,textarea,select") ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !byId("explorer").hidden ||
      byId("figure-dialog").open
    )
      return;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      show(page + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  try {
    const saved = Number(localStorage.getItem(storage));
    show(Number.isFinite(saved) ? saved : 0);
  } catch {
    show(0);
  }
})();
