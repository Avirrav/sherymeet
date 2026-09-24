import { dbConnect } from "@/server/utils/db-connect";
import MeetRegistrant from "@/server/models/meet-registrant";
import { IMeetRegistrantDocument } from "@/server/types/conferenceroom.types";
import { QueryFilter, QuerySelect } from "@/server/types/dao.types";

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
   * Retrieves a single registrant matching the given filter.
   */
  static async getRegistrant(
    filter: QueryFilter<IMeetRegistrantDocument>,
    select?: QuerySelect,
  ): Promise<IMeetRegistrantDocument | null> {
    await dbConnect();
    let query = MeetRegistrant.findOne(filter);
    if (select) {
      query = query.select(select);
    }
    return await query;
  }
}
