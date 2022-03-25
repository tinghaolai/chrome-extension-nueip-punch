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

function checkRecheckPunch(tabId) {
    if (!recheckPunch[tabId]) {
        return;
    }

    let reopenTime = new URL(recheckPunch[tabId].url).searchParams.get('reopenTime');
    if (!reopenTime || parseInt(reopenTime) >= setting.reopenAlertTimes) {
        return;
    }

    fetch(setting.clockApi, {
        method: 'POST',
        headers: setting.apiHeader,
    })
    .then(response => {
        response.json().then((data) => {
            if (!data.user[recheckPunch[tabId].checkColumn]) {
                chrome.tabs.create({
                    url: recheckPunch[tabId].url,
                }).then(tab => {
                    alertTabCreated[tab.id] = true;
                });
            }

            delete(recheckPunch[tabId]);
        });
    });
}

async function getTabs() {
    let queryOptions = { active: true, currentWindow: true };
    let tabs = await chrome.tabs.query(queryOptions);
    return tabs[0];
}

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    checkRecheckPunch(tabId);
});

chrome.webNavigation.onBeforeNavigate.addListener(
    (tab) => {
        checkRecheckPunch(tab.tabId);

        if (targetDomain !== getDomain(tab.url)) {
            return;
        }

        redirectedUrl = '';
        let tabUrl = new URL(tab.url);
        if (!tabUrl.searchParams.get('manipulate-type')) {
            return;
        }

        let redirected = tabUrl.searchParams.get('redirected');
        if (redirected === 'true') {
            return;
        }

        redirectedUrl = tab.url;
    }
);

chrome.webNavigation.onCompleted.addListener(
    (tab) => {
        if (
            targetDomain !== getDomain(tab.url) ||
            setting.loginPath !== getPath(tab.url)
        ) {
            return;
        }

        chrome.scripting.executeScript({
            target: { tabId: tab.tabId },
            func: () => {
                return document.cookie;
            },
        }, (results) => {
            let handleResult = handleNueipApi(results);
            if (!handleResult) {
                return;
            }

            let formData = new FormData();
            formData.append('user', handleResult.csrf);
            formData.append('inputCompany', setting.companyCode);
            formData.append('inputID', setting.employeeCode);
            formData.append('inputPassword', setting.password);

            fetch(setting.loginApi, {
                method: 'POST',
                body: formData,
            })
            .then(response => {
                if (redirectedUrl) {
                    redirectedUrl += '&redirected=true'
                    chrome.tabs.update(
                        tab.tabId,
                        { url: redirectedUrl }
                    );
                }
            })
            .catch(error => alertUser(tab.tabId, 'clockApi error', error));
        });
    }
  );

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        if (!alertTabCreated[tabId]) {
            return;
        }

        alertUser(tabId, 'Heyyyyyyyyyyyyyyyyyyyyyy! u need to do something!');

        delete alertTabCreated[tabId];

        return;
    }

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

    if (setting.punchPath !== getPath(tab.url)) {
        alertUser(tabId, 'wrong path, check-punch-in path should be: ' + setting.punchPath);
        return;
    }

    switch (manipulateType) {
        case 'check-punch-out':
        case 'check-punch-in':
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    return document.cookie;
                },
            }, (results) => {
                if (!handleNueipApi(results)) {
                    return;
                }

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
        case 'punch-in':
        case 'punch-out':
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {
                    return document.cookie;
                },
            }, (results) => {
                if (!handleNueipApi(results)) {
                    return;
                }

                setTimeout(() => {
                    fetch(setting.clockApi, {
                        method: 'POST',
                        headers: setting.apiHeader,
                    })
                    .then(response => {
                        response.json().then((data) => {
                            let checkColumn = (manipulateType === 'punch-in') ? 'A1' : 'A2';
                            if (!data.user[checkColumn]) {
                                alertUser(tabId, 'Hey! Do something, member that?');
                            }
                    })});
                }, 20000);

                fetch(setting.clockApi, {
                    method: 'POST',
                    headers: setting.apiHeader,
                })
                .then(response => {
                    response.json().then((data) => {
                        let checkColumn = (manipulateType === 'punch-in') ? 'A1' : 'A2';
                        if (!data.user[checkColumn]) {
                            let url = new URL(tab.url);
                            let reopenTime = url.searchParams.get('reopenTime');
                            url.searchParams.set('reopenTime', (reopenTime) ? parseInt(reopenTime) + 1 : 1);
                            recheckPunch[tabId] = {
                                checkColumn: checkColumn,
                                url: url.href,
                            };

                            if (manipulateType === 'punch-out' && data.user['A1']) {
                                let dayStart = new Date(data.user.day + ' ' + data.user['A1']);
                                let workHour = (new Date() - dayStart) / 1000 / 3600;
                                if (workHour < setting.workHour) {
                                    alertUser(tabId, 'u havent work enough yet! current hour: ' + workHour);
                                }
                            }

                            let btnId = (manipulateType === 'punch-in') ? 'clockin' : 'clockout';
                            let styles = `
                            @keyframes flickerAnimation {
                              0%   { opacity:1; }
                              50%  { opacity:0; }
                              100% { opacity:1; }
                            }
                            @-o-keyframes flickerAnimation{
                              0%   { opacity:1; }
                              50%  { opacity:0; }
                              100% { opacity:1; }
                            }
                            @-moz-keyframes flickerAnimation{
                              0%   { opacity:1; }
                              50%  { opacity:0; }
                              100% { opacity:1; }
                            }
                            @-webkit-keyframes flickerAnimation{
                              0%   { opacity:1; }
                              50%  { opacity:0; }
                              100% { opacity:1; }
                            }
                            #`+ btnId + ` {
                               -webkit-animation: flickerAnimation .5s infinite;
                               -moz-animation: flickerAnimation .5s infinite;
                               -o-animation: flickerAnimation .5s infinite;
                                animation: flickerAnimation .5s infinite;
                            }
                            `;

                            chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                args: [styles],
                                func: (styles) => {
                                    let styleSheet = document.createElement('style');
                                    styleSheet.innerText = styles;
                                    document.head.appendChild(styleSheet);
                                },
                            }, (results) => {});
                        } else {
                            alertUser(tabId, 'u have already ' + ((manipulateType === 'punch-in') ?
                                'punch in ' : 'punch out'));
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

function handleNueipApi(results) {
    let cookie = results[0];
    if (!cookie || !cookie.result) {
        alertUser(tabId, 'not getting cookie!');

        return false;
    }

    cookie = cookie.result;
    let csrfTokenMatch = cookie.match(/(csrf_token=)([^;]+)/);
    if (!csrfTokenMatch) {
        alertUser(tabId, 'not getting csrf token');

        return false;
    }

    setting.apiHeader['x-csrf-token'] = csrfTokenMatch[2];
    setting.apiHeader['Cookie'] = cookie;

    return {
        csrf: csrfTokenMatch[2],
    };
}

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
    loginPath: '/login',
    punchInBtnId: 'clockin',
    clockApi: 'https://cloud.nueip.com/time_clocks/get_clock',
    loginApi: 'https://cloud.nueip.com/login/index/param',
    apiHeader: {
        'x-csrf-token': '',
        'Cookie': '',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        authority: 'cloud.nueip.com',
    },
    workHour: 8.0,
    reopenAlertTimes: 10,
};

let targetDomain = '';
let redirectedUrl = '';
let recheckPunch = {};
let alertTabCreated = {};
