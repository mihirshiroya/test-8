// Shown while the Go backend starts. Rust navigates this window to the
// backend once it is ready; this script only surfaces startup failures.
;(function () {
  var tauri = window.__TAURI__
  var message = document.getElementById("message")
  var messageText = document.getElementById("message-text")
  var detail = document.getElementById("detail")
  var retry = document.getElementById("retry")

  if (/Mac/i.test(navigator.userAgent)) {
    document.documentElement.classList.add("is-mac")
  }

  document.getElementById("lights").addEventListener("click", function (event) {
    var action = event.target.closest("[data-action]")
    if (!action || !tauri) return
    tauri.window.getCurrentWindow()[action.dataset.action]()
  })

  function showError(text) {
    message.classList.add("error")
    messageText.textContent = "The local backend could not start."
    detail.textContent = text
    detail.hidden = false
    retry.hidden = false
    retry.disabled = false
  }

  function showStarting() {
    message.classList.remove("error")
    messageText.textContent = "Starting your workspace"
    detail.hidden = true
    retry.hidden = true
  }

  function poll() {
    if (!tauri) return
    tauri.core
      .invoke("backend_status")
      .then(function (status) {
        if (status.error && !status.starting) {
          showError(status.error)
          return
        }
        if (!status.ready) showStarting()
        setTimeout(poll, 1000)
      })
      .catch(function () {
        setTimeout(poll, 1000)
      })
  }

  retry.addEventListener("click", function () {
    retry.disabled = true
    showStarting()
    tauri.core
      .invoke("restart_backend")
      .catch(function (error) {
        showError(String(error))
      })
      .finally(function () {
        setTimeout(poll, 1000)
      })
  })

  poll()
})()
