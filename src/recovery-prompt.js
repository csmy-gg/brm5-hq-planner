export function createRecoveryPrompt(dialog, download) {
  return (data, name) => new Promise((resolve, reject) => {
    const yes = dialog.querySelector('[data-recovery-yes]');
    const no = dialog.querySelector('[data-recovery-no]');
    let finished = false;
    const finish = (accepted, error) => {
      if (finished) return;
      finished = true;
      yes.removeEventListener('click', accept);
      no.removeEventListener('click', decline);
      dialog.removeEventListener('close', decline);
      if (dialog.open) dialog.close();
      if (error) reject(error); else resolve(accepted);
    };
    const accept = () => {
      try { download(data, name); finish(true); }
      catch (error) { finish(false, error); }
    };
    const decline = () => finish(false);
    yes.addEventListener('click', accept);
    no.addEventListener('click', decline);
    dialog.addEventListener('close', decline);
    dialog.showModal();
  });
}
