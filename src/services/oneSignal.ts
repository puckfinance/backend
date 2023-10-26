import axios from "axios";



class OneSignalService {
    private static ApiKey = process.env.ONESIGNAL_API_KEY
    private static AppId = process.env.ONESIGNAL_APP_ID
    private static OneSignalHost = "https://onesignal.com/api/v1/notifications"


    public async notifyEventStatus(userId: string, event_status: string, event_id: string) {
        let headersList = {
            "Accept": "*/*",
            "Authorization": `Basic ${OneSignalService.ApiKey}`,
            "Content-Type": "application/json"
        }

        let bodyContent = JSON.stringify({
            app_id: OneSignalService.AppId,
            "contents": {
                "en": `Your booking status has changed to ${event_status}`,
            },
            data: {
                event_status,
                event_id
            },
            channel_for_external_user_ids: "push",
            include_external_user_ids: [userId]
        });

        let reqOptions = {
            url: OneSignalService.OneSignalHost,
            method: "POST",
            headers: headersList,
            data: bodyContent,
        }

        let response = await axios.request(reqOptions);

        return response.data
    }

}
const instance = new OneSignalService();

export default instance;