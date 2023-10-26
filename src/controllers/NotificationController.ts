
import { AppRequest, AppResponse } from "../interfaces";
import { AppRouter } from "./AppRouter";
import OneSignalService from '../services/oneSignal'
import { EventBookingRepository } from "../repositories/EventBookingRepository";


class NotificationController {

    NotifyEventStatus = async (req: AppRequest, res: AppResponse) => {
        const { event_id } = req.body;

        const evt = await EventBookingRepository.getEvent(event_id)

        await OneSignalService.notifyEventStatus(evt.creator_id, evt.status, evt.id)

        res.sendSuccess({});
    }
}



export default () => {
    const controller = new NotificationController();

    const router = new AppRouter();

    router.post('/event-status', controller.NotifyEventStatus)

    return router.router

}