/* Opstarten (na alle onderdelen) */
init();
$('#topDeals').addEventListener('click', ev => { const b = ev.target.closest('[data-open]'); if (b) { const e = dealById(b.dataset.open); if (e) openDealDialog(e); } });
initCloud();
initPWA();
setTimeout(() => checkWatches(), 1500);
