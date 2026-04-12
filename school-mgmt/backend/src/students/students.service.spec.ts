import { Types } from 'mongoose';
import { Role } from '../common/interfaces/role.enum';
import { StudentsService } from './students.service';
import { StudentOrderService } from './student-order.service';
import { StudentReportService } from './student-report.service';

type QueryChainResult = {
  session: jest.Mock;
  select: jest.Mock;
  sort: jest.Mock;
  populate: jest.Mock;
  lean: jest.Mock;
};

function buildQueryChain(result: any): QueryChainResult {
  const chain: Partial<QueryChainResult> = {
    session: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
  };
  const promise = Promise.resolve(result);
  (chain as any).then = promise.then.bind(promise);
  (chain as any).catch = promise.catch.bind(promise);
  return chain as QueryChainResult;
}

function buildUserModel() {
  const UserModel: any = {};
  UserModel.findById = jest.fn();
  UserModel.findOne = jest.fn();
  return UserModel;
}

function buildStudentModel() {
  const StudentModel: any = jest.fn().mockImplementation((payload: any) => ({
    ...payload,
    save: jest.fn().mockImplementation(async (options?: any) => ({
      _id: new Types.ObjectId(),
      options,
      ...payload,
    })),
  }));

  StudentModel.findById = jest.fn();
  StudentModel.findOne = jest.fn();
  StudentModel.find = jest.fn();
  StudentModel.findByIdAndUpdate = jest.fn();
  StudentModel.updateMany = jest.fn();
  StudentModel.deleteMany = jest.fn();
  StudentModel.distinct = jest.fn();
  StudentModel.countDocuments = jest.fn();

  return StudentModel;
}

function buildService(overrides: Partial<{
  studentModel: any;
  attendanceModel: any;
  classroomModel: any;
  sessionModel: any;
  invoiceModel: any;
  userModel: any;
  connection: any;
}> = {}) {
  const studentModel = overrides.studentModel ?? buildStudentModel();
  const attendanceModel = overrides.attendanceModel ?? ({} as any);
  const classroomModel = overrides.classroomModel ?? ({} as any);
  const sessionModel = overrides.sessionModel ?? ({} as any);
  const invoiceModel = overrides.invoiceModel ?? ({} as any);
  const userModel = overrides.userModel ?? buildUserModel();
  const connection = overrides.connection ?? ({} as any);

  const studentOrderService = new StudentOrderService(
    studentModel as any,
    userModel as any,
  );
  const studentReportService = new StudentReportService(
    studentModel as any,
    attendanceModel as any,
    classroomModel as any,
    invoiceModel as any,
  );

  return new StudentsService(
    studentModel as any,
    attendanceModel as any,
    classroomModel as any,
    sessionModel as any,
    userModel as any,
    connection as any,
    studentOrderService,
    studentReportService,
  );
}

describe('StudentsService.findOrCreateStudentFromOrder', () => {
  it('STU-01 updates an existing student and does not create a new record', async () => {
    const service = buildService();
    const studentModel = (service as any).studentModel;
    const userModel = (service as any).userModel;
    const session = { id: 'session-1' };
    const parentUserId = new Types.ObjectId().toHexString();
    const studentId = new Types.ObjectId().toHexString();

    userModel.findById.mockReturnValue(
      buildQueryChain({
        _id: new Types.ObjectId(parentUserId),
        role: Role.PARENT,
      }),
    );
    studentModel.findById.mockReturnValueOnce(
      buildQueryChain({
        _id: new Types.ObjectId(studentId),
        studentCode: 'HS123',
        parentUserId: null,
        parentName: 'Old Parent',
        parentPhone: '0901000001',
        age: 8,
        grade: '3',
        level: 'L3',
        faceImage: 'default-avatar.png',
        approvalStatus: 'APPROVED',
      }),
    );

    const result = await service.findOrCreateStudentFromOrder(
      {
        _id: new Types.ObjectId(),
        existingStudentId: studentId,
        studentCode: 'hs123',
        studentName: 'Nguyen Van A',
        parentName: 'Nguyen Van B',
        parentPhone: '0902000002',
        studentGrade: '4',
        studentLevel: 'L4',
        studentAge: 10,
        studentFaceImage: 'face.png',
        consultationNotes: 'Can duoc ho tro',
        items: [
          {
            productId: new Types.ObjectId(),
            subject: 'Math',
            learningGoals: 'Improve',
          },
        ],
      },
      parentUserId,
      { _id: parentUserId, role: 'DIRECTOR' } as any,
      session as any,
    );

    expect(result).toEqual({
      studentId,
      studentCode: 'HS123',
      isNew: false,
    });
    expect(userModel.findById.mock.results[0].value.session).toHaveBeenCalledWith(session);
    expect(studentModel.findById.mock.results[0].value.session).toHaveBeenCalledWith(session);
    expect(studentModel).not.toHaveBeenCalled();
    expect(studentModel.findByIdAndUpdate).toHaveBeenCalledWith(
      new Types.ObjectId(studentId),
      expect.objectContaining({
        orderId: expect.any(Object),
        parentUserId: new Types.ObjectId(parentUserId),
        faceImage: 'face.png',
        learningNeeds: 'Can duoc ho tro | Improve',
        preferredTeachingMode: 'BOTH',
        subjects: ['Math'],
      }),
      { session },
    );
  });

  it('STU-02 creates a new student and links it to the parent', async () => {
    const service = buildService();
    const studentModel = (service as any).studentModel;
    const userModel = (service as any).userModel;
    const session = { id: 'session-2' };
    const parentUserId = new Types.ObjectId().toHexString();
    const savedStudentId = new Types.ObjectId().toHexString();
    let savedOptions: any;

    studentModel.mockImplementation((payload: any) => ({
      ...payload,
      save: jest.fn().mockImplementation(async (options?: any) => {
        savedOptions = options;
        return { _id: new Types.ObjectId(savedStudentId) };
      }),
    }));

    userModel.findById.mockReturnValue(
      buildQueryChain({
        _id: new Types.ObjectId(parentUserId),
        role: Role.PARENT,
      }),
    );
    studentModel.findOne.mockImplementation((filter: any) => {
      if (filter?.studentCode === 'HS777') {
        return buildQueryChain(null);
      }
      if (filter?.parentPhone === '0907000001' && filter?.fullName === 'New Student') {
        return buildQueryChain(null);
      }
      return buildQueryChain(null);
    });

    const result = await service.findOrCreateStudentFromOrder(
      {
        _id: new Types.ObjectId(),
        studentCode: 'hs777',
        studentName: 'New Student',
        parentName: 'Parent New',
        parentPhone: '0907000001',
        studentGrade: '5',
        studentLevel: 'L5',
        studentAge: 11,
        studentFaceImage: 'face-new.png',
        consultationNotes: 'Need support',
        items: [
          {
            productId: new Types.ObjectId(),
            subject: 'English',
            learningGoals: 'Grammar',
          },
        ],
      },
      parentUserId,
      { _id: parentUserId, role: 'DIRECTOR', fullName: 'Director' } as any,
      session as any,
    );

    expect(result).toEqual({
      studentId: savedStudentId,
      studentCode: 'HS777',
      isNew: true,
    });
    expect(studentModel).toHaveBeenCalledTimes(1);
    expect(studentModel).toHaveBeenCalledWith(
      expect.objectContaining({
        studentCode: 'HS777',
        fullName: 'New Student',
        parentUserId: new Types.ObjectId(parentUserId),
        parentName: 'Parent New',
        parentPhone: '0907000001',
      }),
    );
    expect(savedOptions).toEqual({ session });
  });

  it('STU-03 preserves existing parent links when updating a student', async () => {
    const service = buildService();
    const studentModel = (service as any).studentModel;
    const existingId = new Types.ObjectId();
    const ownerParentId = new Types.ObjectId().toHexString();
    const secondaryParentId = new Types.ObjectId().toHexString();

    studentModel.findById.mockReturnValueOnce(
      buildQueryChain({
        _id: existingId,
        saleId: null,
        parentUserId: new Types.ObjectId(ownerParentId),
        parentUserIds: [new Types.ObjectId(ownerParentId), new Types.ObjectId(secondaryParentId)],
      }),
    );

    await service.update(existingId.toHexString(), {
      fullName: 'Updated Student',
      parentName: 'Updated Parent',
    } as any);

    expect(studentModel.findByIdAndUpdate).toHaveBeenCalledWith(
      existingId.toHexString(),
      expect.objectContaining({
        fullName: 'Updated Student',
        parentName: 'Updated Parent',
        parentUserId: new Types.ObjectId(ownerParentId),
        parentUserIds: expect.arrayContaining([
          expect.any(Object),
          expect.any(Object),
        ]),
      }),
      { new: true },
    );
  });

  it('STU-04 includes students linked by parentUserIds in parent visibility', async () => {
    const service = buildService();
    const studentModel = (service as any).studentModel;
    const parentId = new Types.ObjectId();
    studentModel.find.mockReturnValue(
      buildQueryChain([
        {
          _id: new Types.ObjectId(),
          studentCode: 'HS900',
          fullName: 'Linked Child',
          age: 9,
          grade: '4',
          level: 'L4',
          studentBirthMonth: 4,
          parentBirthMonth: 6,
          parentUserId: null,
          parentUserIds: [parentId],
          parentName: 'Parent A',
          parentPhone: '0909000000',
          saleId: null,
          saleName: '',
          faceImage: 'face.png',
          approvalStatus: 'APPROVED',
          productPackage: null,
        },
      ]),
    );

    const rows = await service.findAll({
      role: Role.PARENT,
      sub: parentId.toHexString(),
    } as any);

    expect(studentModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: [
          { parentUserId: parentId },
          { parentUserIds: parentId },
        ],
      }),
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          parentUserId: '',
          parentUserIds: [parentId.toHexString()],
          studentCode: 'HS900',
        }),
      ]),
    );
  });
});
