(() => {
  const welcomeView = document.querySelector("#welcomeView");
  const accessModal = document.querySelector("#modal-access");
  const toast = document.querySelector("#toast");
  if (!welcomeView || !accessModal) return;

  const normalize = value => String(value || "").trim().toLowerCase();
  let toastTimer;
  let lastFocusedElement = null;
  let adminSignupAllowed = false;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
  }

  function readAccounts() {
    try {
      const savedAccounts = localStorage.getItem("tajiri-pos-accounts");
      if (savedAccounts !== null) {
        const accounts = JSON.parse(savedAccounts);
        return Array.isArray(accounts) ? accounts : [];
      }
      const savedState = JSON.parse(localStorage.getItem("tajiri-pos") || "null");
      return Array.isArray(savedState?.users) ? savedState.users : [];
    } catch (error) {
      console.error("Could not read Tajiri POS accounts:", error);
      showToast("Saved account data could not be read on this device.");
      return [];
    }
  }

  function saveAccounts(accounts) {
    try {
      localStorage.setItem("tajiri-pos-accounts", JSON.stringify(accounts));
      const savedState = JSON.parse(localStorage.getItem("tajiri-pos") || "{}");
      localStorage.setItem("tajiri-pos", JSON.stringify({ ...savedState, users: accounts }));
      return true;
    } catch (error) {
      console.error("Could not save Tajiri POS accounts:", error);
      showToast("Could not save the account on this device.");
      return false;
    }
  }

  async function hashPassword(password) {
    if (globalThis.crypto?.subtle) {
      try {
        const bytes = new TextEncoder().encode(password);
        const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      } catch (error) {
        console.warn("Web Crypto is unavailable; using the local compatibility hash.", error);
      }
    }
    let hash = 2166136261;
    for (const character of password) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return `fallback-${(hash >>> 0).toString(16)}`;
  }

  function sessionSignature(user, role) {
    const value = `${String(user || "").trim()}|${String(role || "").trim()}|tajiri-pos-session-v1`;
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function startSession(account, remember) {
    const identity = normalize(account.username || account.email || String(account.name || "").replace(/\s+/g, "."));
    const role = normalize(account.role);
    const signature = sessionSignature(identity, role);
    sessionStorage.setItem("tajiri-session-user", identity);
    sessionStorage.setItem("tajiri-session-role", role);
    sessionStorage.setItem("tajiri-session-signature", signature);

    if (remember) {
      localStorage.setItem("tajiri-remembered-user", identity);
      localStorage.setItem("tajiri-remembered-role", role);
      localStorage.setItem("tajiri-remembered-signature", signature);
    } else {
      localStorage.removeItem("tajiri-remembered-user");
      localStorage.removeItem("tajiri-remembered-role");
      localStorage.removeItem("tajiri-remembered-signature");
    }

    window.location.reload();
  }

  function setActiveTab(tabName) {
    if (tabName === "signup" && !adminSignupAllowed) tabName = "login";
    document.querySelectorAll("#modal-access [data-tab]").forEach(tab => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("#modal-access .auth-form").forEach(form => {
      form.classList.toggle("active", form.id === `${tabName}Form`);
    });
    const heading = accessModal.querySelector(".modal-head h2");
    if (heading) heading.textContent = tabName === "signup" ? "Set up administrator" : "Sign in to Tajiri POS";
  }

  function openModal(modal, trigger = document.activeElement) {
    if (!modal) return;
    lastFocusedElement = trigger instanceof HTMLElement ? trigger : null;
    modal.hidden = false;
    modal.querySelector("input:not([type=hidden]), button, a")?.focus();
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    lastFocusedElement?.focus();
  }

  function showError(id, message) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
  }

  function clearError(id) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = "";
      element.hidden = true;
    }
  }

  const savedState = (() => {
    try {
      return JSON.parse(localStorage.getItem("tajiri-pos") || "null");
    } catch (error) {
      console.error("Could not read Tajiri POS settings:", error);
      return null;
    }
  })();
  const settings = savedState?.settings || {};
  const roleShell = new URLSearchParams(window.location.search)
    .get("roleShell")
    ?.toLowerCase();
  const firstAdminEmail = "konyangodancan@gmail.com";
  function setAdminSignupAllowed(allowed) {
    adminSignupAllowed = Boolean(allowed && roleShell === "admin");
    const signupTab = document.querySelector("#tabSignup");
    const signupForm = document.querySelector("#signupForm");
    const signupSwitch = document.querySelector("#signupSwitch");
    const signupRole = document.querySelector("#signupRole");
    const adminSetupButton = document.querySelector("#adminSetupButton");
    if (adminSetupButton) adminSetupButton.hidden = !adminSignupAllowed;
    if (signupTab) {
      signupTab.hidden = !adminSignupAllowed;
      if (adminSignupAllowed) signupTab.textContent = "Admin sign up";
    }
    if (signupForm) signupForm.hidden = !adminSignupAllowed;
    if (signupSwitch) signupSwitch.hidden = !adminSignupAllowed;
    if (signupRole) {
      signupRole.value = "admin";
      signupRole.closest("label")?.setAttribute("hidden", "");
    }
  }
  const firebaseEnabled = Boolean(window.firebaseAuth && window.firebaseDb);
  if (firebaseEnabled) {
    setAdminSignupAllowed(false);
    window.firebaseDb
      .collection("system")
      .doc("bootstrap")
      .get()
      .then(snapshot => setAdminSignupAllowed(!snapshot.exists))
      .catch(error => {
        console.error("Could not check Firebase admin setup:", error);
        showToast("Could not check cloud setup. Verify Firestore is enabled and try again.");
      });
  } else {
    setAdminSignupAllowed(false);
  }
  setActiveTab("login");
  if (roleShell === "cashier") {
    const heroTitle = document.querySelector("#welcomeHeroTitle");
    if (heroTitle) heroTitle.textContent = "Cashier sign in";
    const modalHeading = accessModal.querySelector(".modal-head h2");
    if (modalHeading) modalHeading.textContent = "Cashier sign in";
    accessModal.setAttribute("aria-label", "Cashier sign in");
    const loginHeading = document.querySelector("#loginForm h2");
    if (loginHeading) loginHeading.textContent = "Ready for your shift?";
    const loginDescription = document.querySelector("#loginForm .auth-sub");
    if (loginDescription)
      loginDescription.textContent =
      "Use the email and password provided by your administrator.";
  }
  if (window.__tajiriFirebaseError) showToast(window.__tajiriFirebaseError);
  if (!firebaseEnabled && !window.__tajiriFirebaseError) {
    showToast(
      "Cloud sign-in is unavailable. Local accounts only work on this browser.",
    );
  }
  const brand = settings.receiptShopName || settings.storeName || "Tajiri POS";
  const tagline = settings.welcomeTagline || "Smart POS Solutions for Modern Shops";
  document.querySelector("#welcomeBrandName")?.replaceChildren(document.createTextNode(brand));
  document.querySelector("#welcomeFooterBrand")?.replaceChildren(document.createTextNode(brand));
  document.querySelector("#welcomeTagline")?.replaceChildren(document.createTextNode(tagline));
  if (roleShell === "cashier") {
    const welcomeTagline = document.querySelector("#welcomeTagline");
    if (welcomeTagline)
      welcomeTagline.textContent = "Sign in to start your shift and process sales.";
  }
  const heroYear = document.querySelector("#heroYear");
  if (heroYear) heroYear.textContent = String(new Date().getFullYear());
  const heroAccounts = document.querySelector("#heroAccounts");
  if (heroAccounts) {
    heroAccounts.textContent = "";
    heroAccounts.hidden = true;
  }
  if (roleShell === "cashier") openModal(accessModal);

  document.addEventListener("click", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const openTrigger = target.closest("[data-modal-open]");
    if (openTrigger) {
      const modal = document.getElementById(openTrigger.dataset.modalOpen);
      if (modal) {
        openModal(modal, openTrigger);
        const tab = openTrigger.dataset.authTab;
        if (tab === "login" || tab === "signup") setActiveTab(tab);
      }
    }

    const tab = target.closest("[data-tab]");
    if (tab && accessModal.contains(tab)) setActiveTab(tab.dataset.tab);

    const switchButton = target.closest("[data-switch]");
    if (switchButton) setActiveTab(switchButton.dataset.switch);

    const closeTrigger = target.closest("[data-modal-close]");
    if (closeTrigger) closeModal(closeTrigger.closest(".modal-layer"));

    if (target.classList.contains("modal-layer")) closeModal(target);

    const navButton = target.closest("#navMoreBtn");
    const menu = document.querySelector("#navMoreMenu");
    if (navButton && menu) {
      menu.hidden = !menu.hidden;
      navButton.setAttribute("aria-expanded", String(!menu.hidden));
    } else if (menu && !target.closest("#navMoreMenu")) {
      menu.hidden = true;
      document.querySelector("#navMoreBtn")?.setAttribute("aria-expanded", "false");
    }

    if (target.closest("#forgotLink")) {
      const resetModal = document.querySelector("#modal-password-reset");
      if (resetModal) openModal(resetModal, target.closest("#forgotLink"));
    }

    if (target.closest("#passwordResetResend")) {
      event.preventDefault();
      showToast("Password reset delivery is not configured. Contact your store administrator.");
    }

    if (target.closest("[data-installer-download]")) {
      const downloadsModal = document.querySelector("#modal-downloads");
      if (downloadsModal) {
        event.preventDefault();
        openModal(downloadsModal, target.closest("[data-installer-download]"));
      }
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      document.querySelectorAll(".modal-layer:not([hidden])").forEach(closeModal);
      const menu = document.querySelector("#navMoreMenu");
      if (menu) menu.hidden = true;
      document.querySelector("#navMoreBtn")?.setAttribute("aria-expanded", "false");
    }
  });

  document.querySelector("#loginForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    clearError("loginError");
    const identity = normalize(document.querySelector("#loginIdentity")?.value);
    const password = document.querySelector("#loginPassword")?.value || "";
    if (!identity || !password) {
      return showError(
        "loginError",
        firebaseEnabled
          ? "Enter your email and password."
          : "Enter your username or email and password.",
      );
    }

    const submit = document.querySelector("#loginSubmit");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Checking account…";
    }
    try {
      if (firebaseEnabled) {
        if (!identity.includes("@")) {
          showError("loginError", "Sign in with the email address set by your administrator.");
          return;
        }
        const remember = Boolean(document.querySelector("#rememberLogin")?.checked);
        await window.firebaseAuth.setPersistence(
          remember
            ? firebase.auth.Auth.Persistence.LOCAL
            : firebase.auth.Auth.Persistence.SESSION,
        );
        const credential = await window.firebaseAuth.signInWithEmailAndPassword(
          identity,
          password,
        );
        if (!credential.user.emailVerified) {
          await credential.user.sendEmailVerification();
          await window.firebaseAuth.signOut();
          showError(
            "loginError",
            "Verify your email using the link we just sent, then sign in again.",
          );
          return;
        }
        const profileSnapshot = await window.firebaseDb
          .collection("users")
          .doc(credential.user.uid)
          .get();
        let profile = profileSnapshot.exists
          ? { ...profileSnapshot.data(), uid: credential.user.uid }
          : null;
        if (
          !profile &&
          identity === firstAdminEmail &&
          roleShell === "admin"
        ) {
          const bootstrapRef = window.firebaseDb.collection("system").doc("bootstrap");
          const bootstrapSnapshot = await bootstrapRef.get();
          if (!bootstrapSnapshot.exists) {
            let pendingProfile = null;
            try {
              pendingProfile = JSON.parse(
                localStorage.getItem("tajiri-pending-admin-profile") || "null",
              );
            } catch (error) {
              console.error("Could not read pending admin profile:", error);
            }
            const username =
              pendingProfile?.username ||
              identity.split("@")[0].replace(/[^a-z0-9._-]/g, "").slice(0, 60) ||
              "admin";
            profile = {
              name: pendingProfile?.name || credential.user.displayName || identity,
              username,
              email: identity,
              phone: pendingProfile?.phone || "",
              role: "admin",
              uid: credential.user.uid,
              createdAt: new Date().toISOString(),
            };
            await window.firebaseDb.runTransaction(async transaction => {
              const currentBootstrap = await transaction.get(bootstrapRef);
              if (currentBootstrap.exists) {
                throw new Error("Admin setup has already been completed.");
              }
              transaction.set(bootstrapRef, {
                adminUid: credential.user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
              transaction.set(
                window.firebaseDb.collection("users").doc(credential.user.uid),
                profile,
              );
            });
            localStorage.removeItem("tajiri-pending-admin-profile");
          }
        }
        if (!profile || !["admin", "cashier"].includes(profile.role)) {
          await window.firebaseAuth.signOut();
          showError(
            "loginError",
            "This Firebase account has no Tajiri POS role. Ask your administrator to create or repair the account.",
          );
          return;
        }
        saveAccounts([profile]);
        startSession(profile, remember);
        return;
      }
      const accounts = readAccounts();
      const account = accounts.find(candidate =>
        [candidate.username, candidate.email, candidate.name]
          .filter(Boolean)
          .some(value => normalize(value) === identity)
      );
      if (!account?.passwordHash || account.passwordHash !== await hashPassword(password)) {
        showError("loginError", "That username/email and password combination was not found.");
        return;
      }
      startSession(account, Boolean(document.querySelector("#rememberLogin")?.checked));
    } catch (error) {
      console.error("Tajiri POS sign-in failed:", error);
      if (firebaseEnabled && window.firebaseAuth.currentUser) {
        try {
          await window.firebaseAuth.signOut();
        } catch (signOutError) {
          console.error("Could not close the failed Firebase sign-in:", signOutError);
        }
      }
      showError(
        "loginError",
        error.code === "auth/invalid-credential" ||
          error.code === "auth/wrong-password" ||
          error.code === "auth/user-not-found"
          ? "The email or password is incorrect."
          : "Sign-in could not be completed. Check your connection and Firebase setup, then try again.",
      );
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Sign in →";
      }
    }
  });

  document.querySelector("#signupForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    clearError("signupError");
    if (!firebaseEnabled) {
      showError(
        "signupError",
        "Cloud account setup is unavailable. Check Firebase Authentication and Firestore, then refresh.",
      );
      return;
    }
    if (!adminSignupAllowed) {
      showError("signupError", "Ask an administrator to create your cashier account.");
      return;
    }

    const name = document.querySelector("#signupName")?.value.trim() || "";
    const username = normalize(document.querySelector("#signupUsername")?.value);
    const email = normalize(document.querySelector("#signupEmail")?.value);
    const phone = document.querySelector("#signupPhone")?.value.trim() || "";
    const password = document.querySelector("#signupPassword")?.value || "";
    const confirmation = document.querySelector("#signupConfirmPassword")?.value || "";
    if (!name || !username || !email || !password || !confirmation) {
      return showError("signupError", "Complete all required fields to create the account.");
    }
    if (!/^[a-z0-9._-]{2,60}$/.test(username)) {
      return showError("signupError", "Use 2–60 letters, numbers, dots, underscores, or hyphens for the username.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return showError("signupError", "Enter a valid email address.");
    }
    if (firebaseEnabled && email !== firstAdminEmail) {
      return showError("signupError", "Use the email address authorized for first administrator setup.");
    }
    if (phone && !/^(\+254(7|1)[0-9]{7}|(07|01)[0-9]{8})$/.test(phone)) {
      return showError("signupError", "Use a Kenyan phone number without spaces, for example 0712345678.");
    }
    if (password.length < 6) return showError("signupError", "Use a password with at least 6 characters.");
    if (password !== confirmation) return showError("signupError", "The passwords do not match.");

    const submit = document.querySelector("#signupSubmit");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Creating account…";
    }
    try {
      await window.firebaseAuth.setPersistence(
        firebase.auth.Auth.Persistence.SESSION,
      );
      const credential = await window.firebaseAuth.createUserWithEmailAndPassword(
        email,
        password,
      );
      try {
        await credential.user.updateProfile({ displayName: name });
        await credential.user.sendEmailVerification();
        localStorage.setItem(
          "tajiri-pending-admin-profile",
          JSON.stringify({ name, username, email, phone }),
        );
        await window.firebaseAuth.signOut();
        showError(
          "signupError",
          "Check your email and verify the address. Then return to Admin sign in and sign in to finish setup.",
        );
        return;
      } catch (error) {
        await credential.user.delete();
        throw error;
      }
    } catch (error) {
      console.error("Tajiri POS account creation failed:", error);
      showError("signupError", "The account could not be created. Please try again.");
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Create account →";
      }
    }
  });

  document.querySelector("#passwordResetForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = normalize(document.querySelector("#passwordResetIdentity")?.value);
    if (!firebaseEnabled) {
      showError("passwordResetError", "Password reset delivery is not configured. Contact your store administrator.");
      return;
    }
    try {
      await window.firebaseAuth.sendPasswordResetEmail(email);
      showToast("Password reset instructions sent to your email.");
      closeModal(document.querySelector("#modal-password-reset"));
    } catch (error) {
      console.error("Tajiri POS password reset failed:", error);
      showError("passwordResetError", "Could not send the reset email. Check the address and Firebase email settings.");
    }
  });
  document.querySelector("#passwordResetConfirmForm")?.addEventListener("submit", event => {
    event.preventDefault();
    showError("passwordResetConfirmError", "Password reset delivery is not configured. Contact your store administrator.");
  });

  document.querySelector("#signupPassword")?.addEventListener("input", event => {
    const meter = document.querySelector("#strengthMeter");
    const fill = document.querySelector("#strengthFill");
    const label = document.querySelector("#strengthLabel");
    const value = event.target.value;
    if (!meter || !fill || !label) return;
    meter.hidden = !value;
    const score = Math.min(4, Number(value.length >= 8) + Number(/[A-Z]/.test(value)) + Number(/[0-9]/.test(value)) + Number(/[^a-zA-Z0-9]/.test(value)));
    const levels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
    fill.style.width = `${score * 25}%`;
    fill.style.background = score < 2 ? "#f08c8c" : score < 4 ? "#e5bd70" : "#79e2ae";
    label.textContent = levels[score];
  });

  const rememberedIdentity = localStorage.getItem("tajiri-remembered-user");
  const rememberedRole = localStorage.getItem("tajiri-remembered-role");
  const rememberedSignature = localStorage.getItem("tajiri-remembered-signature");
  if (
    rememberedIdentity &&
    rememberedRole &&
    rememberedSignature === sessionSignature(rememberedIdentity, rememberedRole)
  ) {
    const identityField = document.querySelector("#loginIdentity");
    const rememberField = document.querySelector("#rememberLogin");
    if (identityField) identityField.value = rememberedIdentity;
    if (rememberField) rememberField.checked = true;
  }
})();
