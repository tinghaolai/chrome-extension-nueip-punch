
function settingRelatedScript() {
    targetDomain = getDomain(setting.targetSite);
}

function readTextFile(file, callback) {
    fetch(chrome.runtime.getURL('/setting.json'))
        .then((response) => {
            response.json().then((fileSetting) => {
                Object.keys(fileSetting).forEach(key => {
                    setting[key] = fileSetting[key];
                });

                settingRelatedScript();
            });
        });
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
                alertUser(tabId, 'wrong path, check-punch-in path should be: ' + setting.punchPath);
                break;
            }

            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    return document.cookie;
                },
            }, (results) => {
                let cookie = results[0];
                if (!cookie || !cookie.result) {
                    alertUser(tabId, 'not getting cookie!');

                    return;
                }

                cookie = cookie.result;
                let csrfTokenMatch = cookie.match(/(csrf_token=)([^;]+)/);
                if (!csrfTokenMatch) {
                    alertUser(tabId, 'not getting csrf token');
                }

                setting.apiHeader['x-csrf-token'] = csrfTokenMatch[2];
                setting.apiHeader['Cookie'] = cookie;

                fetch(setting.clockApi, {
                    method: 'POST',
                    headers: setting.apiHeader,
                })
                    .then(response => {
                        response.json().then((data) => {
                            let checkColumn = (manipulateType === 'check-punch-in') ? 'A1' : 'A2';
                            if (!data.user[checkColumn]) {
                                alertUser(tabId, 'U havent ' + ((manipulateType === 'check-punch-in') ? 'punch in!' : 'punch out!'));
                            } else {
                                chrome.tabs.remove(tabId, () => {});
                            }
                        });
                    })
                    .catch(error => alertUser(tabId, 'clockApi error', error));
            });

            break;
        default:
            alertUser(tabId, 'unknown manipulate-type');
    }
});

function getDomain(url) {
    return url.replace('http://','').replace('https://','').split(/[/?#]/)[0];
}


function alertUser(tabId, msg, error = null) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (msg) => {
            alert(msg);

            return 'error';
        },
        args: [msg],
    }, () => {});

    if (error) {
        console.log('alert user error');
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