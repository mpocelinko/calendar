import {createApp} from './app.js';
import {createICloudStore} from './icloud.js';
const {ICLOUD_USERNAME,ICLOUD_APP_PASSWORD,ICLOUD_CALENDAR_NAME,APP_PASSPHRASE,CALENDAR_TIME_ZONE='America/New_York',NODE_ENV,PORT='3000'}=process.env;
new Intl.DateTimeFormat('en',{timeZone:CALENDAR_TIME_ZONE}).format();
const store=ICLOUD_USERNAME&&ICLOUD_APP_PASSWORD&&ICLOUD_CALENDAR_NAME?createICloudStore({username:ICLOUD_USERNAME,password:ICLOUD_APP_PASSWORD,calendarName:ICLOUD_CALENDAR_NAME,zone:CALENDAR_TIME_ZONE}):null;
createApp({store,passphrase:APP_PASSPHRASE,secure:NODE_ENV!=='development'}).listen(Number(PORT),'0.0.0.0',()=>console.log('Calendar server listening. iCloud configuration '+(store?'present (connection checked on sign-in)':'incomplete')));
