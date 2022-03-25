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

chrome.webNavigation.onBeforeNavigate.addListener(
    (tab) => {
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
)

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
  )

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
};

let targetDomain = '';
let redirectedUrl = '';