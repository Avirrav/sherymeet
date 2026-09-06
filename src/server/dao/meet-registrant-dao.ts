import { dbConnect } from "@/server/utils/db-connect";
import MeetRegistrant from "@/server/models/meet-registrant";
import { IMeetRegistrantDocument } from "@/server/types/conferenceroom.types";

export interface ICreateRegistrantInput {
  roomId: string;
  token: string;
  email: string;
  firstName: string;
  lastName: string;
}

export class MeetRegistrantDao {
  /**
   * Creates and saves a new MeetRegistrant document in MongoDB.
   */
  static async createRegistrant(
    registrantData: ICreateRegistrantInput,
  ): Promise<IMeetRegistrantDocument> {
    await dbConnect();
    const registrant = new MeetRegistrant(registrantData);
    return await registrant.save();
  }

  /**
   * Retrieves a registrant by their join token — the lookup used when a
   * registrant follows their emailed join link.
   */
  static async getRegistrantByToken(token: string): Promise<IMeetRegistrantDocument | null> {
    await dbConnect();
    return await MeetRegistrant.findOne({ token });
  }

  /**
   * Retrieves a registrant by webinar + email — backed by the schema's
   * unique { roomId, email } index (see meet-registrant.ts), so this is an
   * indexed lookup, not a collection scan.
   */
  static async getRegistrantByEmail(
    roomId: string,
    email: string,
  ): Promise<IMeetRegistrantDocument | null> {
    await dbConnect();
    return await MeetRegistrant.findOne({ roomId, email: email.trim().toLowerCase() });
  }
}
