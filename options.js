function save_options() {
    var apikey = document.getElementById('apikey').value;
    var location = document.getElementById('location').value;

    chrome.storage.sync.set({ 'apikey': apikey, 'location': location },
        function() {
            const status = document.getElementById('status');
            status.textContent = 'Options saved.';
            setTimeout(function() {
                status.textContent = '';
                close();
            }, 750);
        });
}

function reset_options() {
    chrome.storage.sync.set({ 'apikey': 'NEEDTOBEFILLED', 'location': 'TIC-LOCATION' },
        function() {
            const status = document.getElementById('status');
            status.textContent = 'Options have been reseted.';
            setTimeout(function() {
                status.textContent = '';
                close();
            }, 750);
            restore_options();
        });
}

function restore_options() {
    chrome.storage.sync.get({
        'location': 'TIC-LOCATION',
        'apikey': 'NEEDTOBEFILLED'
    }, function(items) {
        document.getElementById('apikey').value = items.apikey;
        document.getElementById('location').value = items.location;
    })
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);
document.getElementById('reset').addEventListener('click', reset_options);