const { default: axios } = require("axios");

function settingRelatedScript() {
    targetDomain = getDomain(setting.targetSite);
}

function readTextFile(file, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = (file) => {
        if(xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
            let fileSetting = JSON.parse(xhr.responseText);
            Object.keys(fileSetting).forEach(key => {
                setting[key] = fileSetting[key];
            });
            
            settingRelatedScript();
        }
    };
    xhr.open("GET", chrome.extension.getURL('./setting.json'), true);
    xhr.send();
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'loading') {
        return '';
    }
    
    if (targetDomain !== getDomain(tab.url)) {
        return;
    }

    let manipulateType = new URL(tab.url).searchParams.get('manipulate-type');
    if (!manipulateType) {
        return;
    }

    switch (manipulateType) {
        case 'check-punch-out':
        case 'check-punch-in':
            if (setting.punchPath !== getPath(tab.url)) {
                alertUser('wrong path, check-punch-in path should be: ' + setting.punchPath);
                break;
            }

            let code = 'document.cookie';
            chrome.tabs.executeScript(tabId, { code: code }, (results) => {
                let cookie = results[0];
                if (!cookie) {
                    alertUser('not getting cookie!');

                    return;
                }

                let csrfTokenMatch = cookie.match(/(csrf_token=)([^;]+)/);
                if (!csrfTokenMatch) {
                    alertUser('not getting csrf token');
                }
                
                setting.apiHeader['x-csrf-token'] = csrfTokenMatch[2];
                setting.apiHeader['Cookie'] = cookie;
            
                axios.post(setting.clockApi, [], {
                    headers: setting.apiHeader,
                }).then(response => {
                    let checkColumn = (manipulateType === 'check-punch-in') ? 'A1' : 'A2';
                    if (!response.data.user[checkColumn]) {
                        alertUser('U havent ' + ((manipulateType === 'check-punch-in') ? 'punch in!' : 'punch out!'));
                    } else {
                        chrome.tabs.remove(tabId, () => {});
                    }
                }).catch(error => {
                    alertUser('clockApi error', error);
                });
            });

            break;
        default:
            alertUser('unknown manipulate-type');
    }
});

function getDomain(url) {
    return url.replace('http://','').replace('https://','').split(/[/?#]/)[0];
}

function alertUser(msg, error = null) {
    alert(msg);
    
    if (error) {
        console.log(error);
    }
}

function getPath(url) {
    return new URL(url).pathname;
}


// script
readTextFile();

// variable
let setting = {
    targetSite: 'https://cloud.nueip.com',
    punchPath: '/home',
    punchInBtnId: 'clockin',
    clockApi: 'https://cloud.nueip.com/time_clocks/get_clock',
    apiHeader: {
        'x-csrf-token': '',
        'Cookie': '',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        authority: 'cloud.nueip.com',  
    },
};

let targetDomain = '';