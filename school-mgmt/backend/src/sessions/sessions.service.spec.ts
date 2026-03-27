import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SessionsService } from './sessions.service';

describe('SessionsService.submitParentFeedback()', () => {
  it('stores feedback on the explicitly requested session when sessionId is provided', async () => {
    const parentUserId = new Types.ObjectId().toHexString();
    const sessionId = new Types.ObjectId();
    const sessionDoc = { _id: sessionId };
    const findOne = jest.fn().mockResolvedValue(sessionDoc);
    const updateOne = jest.fn().mockResolvedValue(undefined);
    const context = { sessionModel: { findOne, updateOne } } as any;

    const result = await SessionsService.prototype.submitParentFeedback.call(context, parentUserId, {
      sessionId: sessionId.toHexString(),
      overallRating: 5,
      teachingQuality: 4,
      communication: 5,
      comment: 'Rất tốt',
    });

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(findOne.mock.calls[0][0]._id.toString()).toBe(sessionId.toHexString());
    expect(findOne.mock.calls[0][0].parentUserId.toString()).toBe(parentUserId);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: sessionId },
      {
        $set: {
          parentFeedback: {
            overallRating: 5,
            teachingQualityRating: 4,
            communicationRating: 5,
            parentNotes: 'Rất tốt',
          },
        },
      },
    );
    expect(result).toEqual({ success: true, message: 'Cảm ơn bạn đã gửi đánh giá!' });
  });

  it('falls back to the latest finalized session only when sessionId is omitted', async () => {
    const parentUserId = new Types.ObjectId().toHexString();
    const sessionId = new Types.ObjectId();
    const sort = jest.fn().mockResolvedValue({ _id: sessionId });
    const findOne = jest.fn().mockReturnValue({ sort });
    const updateOne = jest.fn().mockResolvedValue(undefined);
    const context = { sessionModel: { findOne, updateOne } } as any;

    await SessionsService.prototype.submitParentFeedback.call(context, parentUserId, {
      overallRating: 4,
      comment: 'Ổn',
    });

    expect(findOne).toHaveBeenCalledTimes(1);
    expect(sort).toHaveBeenCalledWith({ scheduledDate: -1 });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: sessionId },
      expect.objectContaining({
        $set: expect.objectContaining({
          parentFeedback: expect.objectContaining({ overallRating: 4, parentNotes: 'Ổn' }),
        }),
      }),
    );
  });

  it('does not fall back when an explicit sessionId does not belong to the parent', async () => {
    const parentUserId = new Types.ObjectId().toHexString();
    const findOne = jest.fn().mockResolvedValue(null);
    const updateOne = jest.fn();
    const context = { sessionModel: { findOne, updateOne } } as any;

    await expect(
      SessionsService.prototype.submitParentFeedback.call(context, parentUserId, {
        sessionId: new Types.ObjectId().toHexString(),
        overallRating: 3,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(updateOne).not.toHaveBeenCalled();
  });
});