## Features

* Punch in / out helper
    * Highlight button to click
    * Alert if work time too short when punch out
    * Reopen page within specific times if didnt punch in/out correctly
* Punch checker
    * Alert if u didnt punch in/out before expired time
    * Close tab if already done
* Auto login
    * Works only when manipulating above functionality

## How it works

Schedule + Chrome extension

1. run schedule to open punch site
2. extension check if punched in / out
3. alert if not, close tab if yes

## How to use
### Chrome Extension

1. `npm run install`
2. `npm run dev`
3. install chrome extension

### Schedule
#### Punch check
1. Add schedule at ur punch in/out expire time.
2. run bat check-punch-in.bat / check-punch-out.bat
    * change browser if ur not using chrome
    * write ur own script if ur not using windows

#### Punch helper
Add schedule at the time when u want to punch in / out.
> punch-in.bat on computer open
>
> punch-in.bat at a freaking early time to prevent forgetting shut down computed which cause composer open bat not working, and wont executed twice.
>
> punch-out.bat when specific time

#### Setting.json

**Must filled**
> Related in login page

```json
{
    "companyCode": "公司代碼",
    "employeeCode": "員工編號",
    "password": "密碼"
}
```

Optional setting
* `workHour`, type: `float`, default: `9.0`: punch out work time checking
* `reopenAlertTimes`, type: `int`, default: `10`: Reopen times if forget punch in / out 
