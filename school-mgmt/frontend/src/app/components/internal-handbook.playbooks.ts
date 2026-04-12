import { Role } from '../models/role.enum';
import { HandbookPlaybook } from './internal-handbook.types';

export const DEFAULT_PLAYBOOK: HandbookPlaybook = {
  headline:
    'Dùng phần này để đọc kỹ hơn từng bước thao tác, cách nhận biết đang làm đúng và các lỗi thường gặp trước khi bắt đầu kiểm thử.',
  stages: [
    {
      title: 'Bước 1: xác nhận đúng tài khoản',
      description: 'Trước khi thao tác, luôn kiểm tra role hiện tại và menu hiển thị có khớp với mục tiêu test hay không.',
      steps: [
        'Mở dashboard và xem nhãn vai trò đang đăng nhập.',
        'Đối chiếu menu hiển thị với quyền mong đợi.',
        'Nếu sai role, đăng xuất và đăng nhập lại trước khi tiếp tục.',
      ],
      successSignal: 'Menu hiển thị đúng vai trò đang muốn kiểm thử.',
      route: '/app/dashboard',
    },
    {
      title: 'Bước 2: đi vào màn hình chính',
      description: 'Chỉ mở các màn hình thuộc phạm vi quyền của vai trò hiện tại để tránh đánh giá sai logic quyền.',
      steps: [
        'Đi theo quick links của handbook hiện tại.',
        'Không dùng link trực tiếp của role khác để kiểm tra quyền.',
        'Nếu hệ thống chặn đúng, ghi nhận là hành vi hợp lệ.',
      ],
      successSignal: 'Có thể mở các màn đúng role, còn màn ngoài quyền bị chặn đúng cách.',
    },
  ],
  pitfalls: [
    {
      title: 'Nhầm role khi test',
      detail: 'Cùng một email hoặc session cũ có thể khiến bạn nghĩ quyền sai. Luôn đăng xuất rồi vào lại bằng tài khoản đúng role.',
    },
    {
      title: 'Đánh giá dựa trên dữ liệu cũ',
      detail: 'Một số màn phụ thuộc dữ liệu mẫu. Nếu dữ liệu trống, hãy phân biệt rõ lỗi quyền và trạng thái không có dữ liệu.',
    },
  ],
  faq: [
    {
      question: 'Khi nào nên dùng handbook này?',
      answer: 'Dùng khi onboarding người mới, kiểm thử quyền, hoặc hướng dẫn vận hành nhanh theo từng tài khoản.',
    },
    {
      question: 'Nếu một màn hình mở được nhưng thao tác không được thì sao?',
      answer: 'Đó có thể là logic đúng giữa quyền xem và quyền sửa. Hãy đối chiếu thêm phần lưu ý quyền và lỗi thường gặp bên dưới.',
    },
  ],
};

export const ROLE_PLAYBOOKS: Record<string, HandbookPlaybook> = {
  [Role.DIRECTOR]: {
    headline:
      'Giám đốc không cần đi quá nhiều màn trong một ngày, nhưng mỗi màn mở ra phải có mục đích rõ: nhìn toàn cảnh, phê duyệt, đối chiếu và truy vết.',
    stages: [
      {
        title: 'Đầu ngày: đọc dashboard như bảng điều khiển',
        description: 'Dashboard là nơi giám đốc lấy bức tranh tổng thể trước khi đi sâu vào từng vấn đề.',
        steps: [
          'Đọc nhanh doanh thu, số buổi học, ticket và các cảnh báo bất thường.',
          'Xác định việc nào cần phê duyệt ngay và việc nào chỉ cần theo dõi.',
          'Ghi nhận điểm nghẽn để lát nữa chuyển đúng người xử lý.',
        ],
        successSignal: 'Giám đốc có thể trả lời ngay hôm nay hệ thống đang nóng ở đâu.',
        route: '/app/dashboard',
      },
      {
        title: 'Giữa ngày: xử lý khu vực chờ duyệt và tài chính',
        description: 'Mục tiêu của giám đốc là ra quyết định sau khi đã có đối chiếu, không duyệt cảm tính.',
        steps: [
          'Mở Chờ duyệt để xem danh sách yêu cầu đang đợi xác nhận.',
          'Nếu là yêu cầu đổi buổi học, đối chiếu thêm học phí và lương giáo viên ngay trên thẻ chờ duyệt.',
          'Nếu nghiệp vụ chạm đến tiền, mở thêm Financial Control để kiểm tra số nền.',
          'Chỉ chốt khi lý do, chứng từ và dữ liệu liên quan đã đủ rõ.',
        ],
        successSignal: 'Mỗi quyết định đều có dữ liệu đối chiếu đi kèm, không có duyệt "mù".',
        route: '/app/pending-approvals',
      },
      {
        title: 'Cuối ngày: truy vết trước khi kết luận',
        description: 'Khi có tranh cãi hoặc sai lệch, Audit log giúp giám đốc nhìn lại dòng thời gian thao tác.',
        steps: [
          'Mở Audit log để biết ai đã tạo, sửa hoặc duyệt nghiệp vụ.',
          'Đối chiếu lịch sử thao tác với dữ liệu đang hiển thị trên màn hình thực tế.',
          'Kết luận dựa trên log thay vì suy đoán.',
        ],
        successSignal: 'Có thể giải thích rõ vì sao một dữ liệu ở trạng thái hiện tại.',
        route: '/app/audit-log',
      },
    ],
    pitfalls: [
      {
        title: 'Dùng tài khoản giám đốc cho thao tác hằng ngày',
        detail: 'Nếu dùng tài khoản giám đốc để làm luôn tác vụ vận hành hoặc kế toán, bạn sẽ rất khó phát hiện lệch quyền ở các vai trò còn lại.',
      },
      {
        title: 'Duyệt trước, đối chiếu sau',
        detail: 'Đây là lỗi rủi ro nhất. Với nghiệp vụ tài chính, luôn mở thêm màn đối soát trước khi bấm duyệt.',
      },
      {
        title: 'Không truy log khi thấy bất thường',
        detail: 'Khi đã có Audit log, việc bỏ qua bước truy vết thường dẫn đến kết luận sai người hoặc sai nguyên nhân.',
      },
    ],
    faq: [
      {
        question: 'Giám đốc nên mở handbook này lúc nào?',
        answer: 'Phù hợp nhất ở đầu ngày, khi onboarding quản lý mới, hoặc khi cần xác nhận nhanh một luồng quyền/phê duyệt có đang đúng logic hay không.',
      },
      {
        question: 'Nếu màn chờ duyệt trống thì có phải lỗi không?',
        answer: 'Không. Đó có thể chỉ là không có dữ liệu chờ duyệt. Cần phân biệt rõ giữa "không có dữ liệu" và "không có quyền".',
      },
    ],
  },
  [Role.ACCOUNTING]: {
    headline:
      'Kế toán cần hiểu rõ ranh giới giữa xem để đối chiếu và sửa dữ liệu. Handbook này ưu tiên giải thích kỹ các chỗ dễ nhầm giữa ví, hóa đơn, học sinh và payroll.',
    stages: [
      {
        title: 'Đầu ca: xác nhận top-up và biến động ví',
        description: 'Dashboard là nơi kế toán nhận tín hiệu xem hôm nay có yêu cầu nạp tiền nào cần xử lý không.',
        steps: [
          'Nhìn nhanh các số liệu top-up và wallet trên dashboard.',
          'Đi thẳng sang Wallets nếu có yêu cầu đang chờ.',
          'Mở ledger để chắc giao dịch hiển thị đúng sau khi duyệt.',
        ],
        successSignal: 'Số dư ví và ledger khớp nhau sau mỗi lần duyệt.',
        route: '/app/wallets',
      },
      {
        title: 'Trong ngày: đối chiếu hóa đơn và công nợ',
        description: 'Luồng này giúp kế toán chốt trạng thái thanh toán mà không cần đi sửa dữ liệu vận hành.',
        steps: [
          'Mở Invoices để xem danh sách hóa đơn và trạng thái hiện tại.',
          'Khi thấy lệch số, mở thêm báo cáo hoặc sao kê liên quan để so sánh.',
          'Nếu dữ liệu gốc sai từ khâu vận hành, bàn giao lại đúng bộ phận thay vì tự sửa ngoài quyền.',
        ],
        successSignal: 'Kế toán chỉ chạm vào phần tài chính, còn dữ liệu vận hành được chuyển trả đúng nơi.',
        route: '/app/invoices',
      },
      {
        title: 'Cuối kỳ: chốt payroll có đối chiếu',
        description: 'Payroll chỉ đáng tin khi đầu vào từ sessions hoặc teaching report đã đủ sạch.',
        steps: [
          'Mở Teaching report hoặc Sessions để hiểu nguồn dữ liệu lương.',
          'Qua Payroll để xem kỳ tính lương và các buổi đủ điều kiện.',
          'Nếu có tranh chấp, truy lại buổi học thay vì chỉ nhìn số cuối cùng.',
        ],
        successSignal: 'Có thể giải thích mỗi khoản lương bằng dữ liệu buổi học cụ thể.',
        route: '/app/payroll',
      },
    ],
    pitfalls: [
      {
        title: 'Thấy được học sinh rồi sửa luôn hồ sơ',
        detail: 'Kế toán hiện chỉ được đọc học sinh/lớp để đối chiếu. Sửa hồ sơ học sinh vẫn không phải trách nhiệm của role này.',
      },
      {
        title: 'Duyệt top-up nhưng quên nhìn ledger',
        detail: 'Nếu không kiểm lại ledger sau khi duyệt, rất dễ bỏ sót trường hợp giao dịch lên trạng thái sai hoặc số dư không khớp mong đợi.',
      },
      {
        title: 'Chốt lương mà không xem nguồn dữ liệu',
        detail: 'Payroll chỉ là kết quả cuối. Khi có sai khác, phải quay về teaching report hoặc sessions để xác định nguyên nhân.',
      },
    ],
    faq: [
      {
        question: 'Kế toán mở được học sinh/lớp có phải là sai quyền không?',
        answer: 'Không. Đây là thay đổi có chủ đích để kế toán đọc dữ liệu phục vụ đối soát, nhưng quyền sửa vẫn bị chặn ở frontend và backend.',
      },
      {
        question: 'OPS có được chuyển ví không?',
        answer: 'Không. Nút chuyển ví và action chuyển ví chỉ còn cho Giám đốc và Kế toán.',
      },
    ],
  },
  [Role.OPS]: {
    headline:
      'Vận hành là role điều phối. Điểm quan trọng nhất không phải là mở được bao nhiêu màn, mà là biết lúc nào cần xử lý và lúc nào cần bàn giao đúng người.',
    stages: [
      {
        title: 'Chuẩn bị lớp và lịch',
        description: 'Bắt đầu bằng việc chắc lớp học đúng người, đúng lịch, đúng dữ liệu.',
        steps: [
          'Mở Classes để kiểm tra giáo viên, sale và học sinh trên từng lớp.',
          'Sau đó sang Sessions để xem lịch đã được tạo đầy đủ chưa.',
          'Nếu thiếu dữ liệu, sửa ở đúng màn nguồn thay vì vá tạm ở màn khác.',
        ],
        successSignal: 'Lớp, giáo viên và lịch dạy khớp nhau trước giờ vào ca.',
        route: '/app/classes',
      },
      {
        title: 'Theo dõi trong ngày',
        description: 'Mục tiêu là phát hiện sớm điểm nghẽn trước khi nó trở thành sự cố cho phụ huynh hoặc giáo viên.',
        steps: [
          'Xem dashboard vận hành để nắm tình hình tổng quan.',
          'Kiểm tra attendance hoặc sessions nếu thấy buổi học có nguy cơ chậm.',
          'Vào Chờ duyệt khi có yêu cầu đổi buổi học để chốt nhanh trước giờ dạy.',
          'Mở ticket để kéo các bên liên quan vào xử lý sớm.',
        ],
        successSignal: 'Phát sinh được ghi nhận sớm, có ticket và có người chịu trách nhiệm xử lý.',
        route: '/app/tickets',
      },
      {
        title: 'Bàn giao đúng bộ phận',
        description: 'Khi sự cố chạm sang tài chính hoặc sale, vận hành cần dừng ở điểm bàn giao chứ không làm thay.',
        steps: [
          'Nếu sự cố liên quan tiền, đưa sang kế toán hoặc giám đốc.',
          'Nếu phát sinh từ lead hoặc hội thoại khách hàng, kéo sale vào xử lý.',
          'Giữ ticket như nơi ghi dấu vết phối hợp giữa các bên.',
        ],
        successSignal: 'Mỗi phát sinh đều có người nhận xử lý đúng chuyên môn.',
      },
    ],
    pitfalls: [
      {
        title: 'Ôm luôn phần tài chính',
        detail: 'Đây là lỗi rất hay gặp. Vận hành có thể nhìn thấy hệ quả tài chính nhưng không nên tự xử lý các thao tác chạm vào tiền.',
      },
      {
        title: 'Sửa dữ liệu ở màn không phải nguồn',
        detail: 'Ví dụ thấy một buổi học sai nhưng lại vá ở màn khác cho nhanh. Điều này khiến dữ liệu về sau khó truy lại nguồn gốc.',
      },
      {
        title: 'Không dùng ticket để đóng vòng phối hợp',
        detail: 'Nếu chỉ nhắn tin mà không mở ticket, phát sinh rất dễ bị bỏ quên hoặc không có dấu vết bàn giao.',
      },
    ],
    faq: [
      {
        question: 'Vì sao OPS nhìn thấy ví nhưng không được chuyển tiền?',
        answer: 'OPS có thể cần quan sát để phối hợp, nhưng hành động chuyển ví là nghiệp vụ tài chính nên đã bị giới hạn lại đúng role.',
      },
      {
        question: 'Nếu lớp trống học sinh thì handbook có còn đúng không?',
        answer: 'Có. Handbook mô tả luồng thao tác và cách đọc màn hình. Dữ liệu demo có thể khác nhau, nhưng quyền và trật tự xử lý vẫn giữ nguyên.',
      },
    ],
  },
  [Role.TEACHER]: {
    headline:
      'Giáo viên cần một cẩm nang giải thích theo nhịp làm việc thực tế: trước giờ dạy, trong buổi học, sau buổi học và khi có phát sinh nội bộ.',
    stages: [
      {
        title: 'Trước giờ dạy',
        description: 'Đây là lúc giáo viên cần xác nhận lịch, lớp và tài liệu để vào ca chủ động.',
        steps: [
          'Đăng nhập rồi xem dashboard để nắm buổi sắp tới.',
          'Mở lịch dạy để rà khung giờ và lớp phụ trách.',
          'Kiểm tra tài liệu cần dùng hoặc ghi chú mới từ vận hành.',
        ],
        successSignal: 'Giáo viên biết rõ hôm nay dạy lớp nào, lúc nào và cần chuẩn bị gì.',
        route: '/app/dashboard',
      },
      {
        title: 'Ngay sau buổi dạy',
        description: 'Phần quan trọng nhất là không để attendance và teaching report bị treo đến cuối ngày.',
        steps: [
          'Mở Attendance để điểm danh hoặc xác nhận link điểm danh đã dùng đúng.',
          'Đi sang Teaching report để nộp báo cáo giảng dạy ngay sau buổi học.',
          'Đọc lại trạng thái buổi học trước khi rời màn hình.',
        ],
        successSignal: 'Buổi học có attendance và teaching report đầy đủ ngay trong ngày.',
        route: '/app/teaching-report',
      },
      {
        title: 'Khi có phát sinh',
        description: 'Giáo viên không nên xử lý phát sinh bằng cách nhắn miệng hoặc để quên, mà cần đi qua request hoặc ticket.',
        steps: [
          'Nếu không thể dạy đúng lịch, tạo request thay thế càng sớm càng tốt.',
          'Mở ticket nếu cần OPS hoặc bộ phận khác hỗ trợ.',
          'Dùng tin nhắn nội bộ để phối hợp nhanh nhưng vẫn nên có ticket khi sự việc cần theo dấu.',
        ],
        successSignal: 'Mọi phát sinh đều có dấu vết trên hệ thống, không phụ thuộc trí nhớ.',
        route: '/app/teacher-substitute-request',
      },
    ],
    pitfalls: [
      {
        title: 'Để cuối ngày mới điểm danh hoặc viết báo cáo',
        detail: 'Khi làm dồn cuối ngày, giáo viên dễ nhầm lớp, nhầm giờ hoặc quên chi tiết buổi học. Dữ liệu sẽ kém tin cậy hơn nhiều.',
      },
      {
        title: 'Chỉ nhắn tin mà không tạo request thay thế',
        detail: 'Tin nhắn giúp trao đổi nhanh, nhưng request hoặc ticket mới là dấu vết chính thức để vận hành xử lý.',
      },
      {
        title: 'Tưởng payroll sai nhưng không kiểm buổi học',
        detail: 'Nếu lương lệch, hãy quay lại buổi học và teaching report trước. Đa số nguyên nhân nằm ở dữ liệu đầu vào chứ không phải màn payroll.',
      },
    ],
    faq: [
      {
        question: 'Khi nào nên dùng Teacher Hub chi tiết?',
        answer: 'Dùng khi cần tài liệu sâu hơn cho onboarding, xem nhiều ảnh minh họa hơn hoặc cần đọc markdown/checklist chi tiết cho giáo viên.',
      },
      {
        question: 'Nếu attendance đã làm nhưng payroll chưa tính thì sao?',
        answer: 'Hãy kiểm tra thêm teaching report, trạng thái session và điều kiện xác nhận liên quan. Payroll là kết quả cuối của nhiều bước phía trước.',
      },
    ],
  },
  [Role.PARENT]: {
    headline:
      'Phụ huynh cần một hướng dẫn dễ hiểu, ít thuật ngữ nội bộ và giải thích rõ đâu là dữ liệu xem được, đâu là phần chỉ mang tính theo dõi chứ không chỉnh sửa.',
    stages: [
      {
        title: 'Theo dõi tiến độ học',
        description: 'Bắt đầu từ dashboard rồi đi vào tiến độ học để hiểu tình hình tổng quát của con.',
        steps: [
          'Xem dashboard để nắm nhanh buổi học, ví và các mục cần chú ý.',
          'Mở Student progress để xem tiến độ học tập hoặc kết quả liên quan.',
          'Nếu muốn xem cụ thể hơn theo ngày, mở thêm lịch học hoặc điểm danh.',
        ],
        successSignal: 'Phụ huynh có thể trả lời được con đang học đến đâu và có buổi nào cần lưu ý.',
        route: '/app/student-progress',
      },
      {
        title: 'Xác nhận buổi học',
        description: 'Phần này giúp phụ huynh kiểm tra buổi học đã diễn ra và xác nhận theo đúng luồng hệ thống.',
        steps: [
          'Mở Sessions để xem buổi học liên quan.',
          'Đọc nội dung hoặc ghi chú buổi học trước khi xác nhận.',
          'Nếu có thắc mắc, dùng kênh hỗ trợ thay vì cố chỉnh sửa dữ liệu.',
        ],
        successSignal: 'Phụ huynh hiểu mình đang xác nhận cái gì và vì sao cần xác nhận.',
        route: '/app/sessions',
      },
      {
        title: 'Quản lý ví và thanh toán',
        description: 'Ví phụ huynh chỉ dành cho tài khoản của chính mình, không phải khu vực tài chính nội bộ.',
        steps: [
          'Mở Wallets để xem số dư và giao dịch gần nhất.',
          'Khi nạp ví, đính kèm biên lai nếu thanh toán bằng chuyển khoản.',
          'Đối chiếu lại hóa đơn sau khi thanh toán hoặc sau khi ví được duyệt.',
        ],
        successSignal: 'Số dư, giao dịch và hóa đơn của phụ huynh tự khớp nhau sau khi thao tác.',
        route: '/app/wallets',
      },
    ],
    pitfalls: [
      {
        title: 'Tưởng ví là tài khoản chung của trung tâm',
        detail: 'Không phải. Đây là ví của chính phụ huynh đang đăng nhập. Mọi thao tác chỉ áp dụng cho tài khoản này.',
      },
      {
        title: 'Nhìn thấy ít dữ liệu rồi nghĩ hệ thống thiếu quyền',
        detail: 'Phụ huynh vốn chỉ thấy dữ liệu gắn với mình. Ít dữ liệu thường là đúng logic chứ không phải lỗi.',
      },
      {
        title: 'Không đính kèm biên lai khi chuyển khoản',
        detail: 'Nếu dùng chuyển khoản mà thiếu biên lai, quá trình duyệt nạp ví sẽ chậm hoặc bị từ chối vì thiếu căn cứ.',
      },
    ],
    faq: [
      {
        question: 'Phụ huynh có xem được học sinh khác không?',
        answer: 'Không. Phụ huynh chỉ xem dữ liệu học tập, buổi học và ví gắn với tài khoản của mình.',
      },
      {
        question: 'Nếu ví đã gửi yêu cầu nạp mà chưa lên tiền thì sao?',
        answer: 'Cần chờ bước duyệt của kế toán. Trước tiên hãy kiểm tra đã đính kèm đúng chứng từ và thông tin thanh toán hay chưa.',
      },
    ],
  },
  [Role.SALE]: {
    headline:
      'Sale cần nhìn handbook như một lộ trình chuyển đổi: đọc dashboard để biết ưu tiên, chốt lead đúng lúc, tạo order và bàn giao đủ thông tin cho vận hành.',
    stages: [
      {
        title: 'Đầu ngày: đọc funnel',
        description: 'Dashboard sale là nơi nhìn bức tranh đầu ngày: lead nào nóng, lead nào cần follow-up và áp lực doanh số hiện tại ra sao.',
        steps: [
          'Xem dashboard để biết các chỉ số cần ưu tiên.',
          'Chuyển sang Leads để đọc lại danh sách khách hàng đang theo dõi.',
          'Đặt rõ thứ tự xử lý trước khi bắt đầu liên hệ khách.',
        ],
        successSignal: 'Sale biết rõ hôm nay nên tập trung lead nào trước.',
        route: '/app/dashboard',
      },
      {
        title: 'Trong ngày: chốt order có kiểm soát',
        description: 'Order là điểm bàn giao chính thức chứ không chỉ là "đánh dấu đã chốt".',
        steps: [
          'Chỉ tạo order khi lead đã đủ điều kiện.',
          'Kiểm tra lại thông tin bàn giao trước khi lưu order.',
          'Nếu cần đổi giáo viên hoặc thời lượng cho một buổi chưa diễn ra, tạo Session Change Request trên màn Sessions.',
          'Sau khi tạo, theo dõi tiếp tình trạng đơn và phối hợp với OPS nếu cần.',
        ],
        successSignal: 'Order tạo xong là OPS có thể tiếp nhận mà không phải hỏi lại quá nhiều.',
        route: '/app/orders',
      },
      {
        title: 'Cuối vòng: kiểm tra hoa hồng và đầu vào',
        description: 'Đây là bước giúp sale nhìn lại hiệu quả thay vì chỉ chạy theo lead mới.',
        steps: [
          'Mở Commission report để xem các đơn đã phản ánh vào hoa hồng hay chưa.',
          'Đối chiếu thêm Landing pages hoặc Conversations để hiểu chất lượng nguồn lead.',
          'Ghi nhận kênh nào hiệu quả để tối ưu cách follow-up về sau.',
        ],
        successSignal: 'Sale không chỉ chốt đơn mà còn nhìn được kênh nào đang tạo ra đơn chất lượng.',
        route: '/app/commission-report',
      },
    ],
    pitfalls: [
      {
        title: 'Tạo order quá sớm',
        detail: 'Nếu tạo order khi lead chưa đủ điều kiện, OPS sẽ phải xử lý lại rất nhiều và dữ liệu doanh số cũng dễ bị méo.',
      },
      {
        title: 'Không bàn giao đủ thông tin cho OPS',
        detail: 'Một order thiếu thông tin khiến sale tưởng đã xong nhưng thực tế vận hành không thể triển khai trơn tru.',
      },
      {
        title: 'Chỉ nhìn số lượng lead mà không nhìn chất lượng',
        detail: 'Dashboard và báo cáo hoa hồng cần được đọc cùng nhau để hiểu nguồn lead nào đang tạo ra đơn thật.',
      },
    ],
    faq: [
      {
        question: 'Sale có cần vào landing pages không?',
        answer: 'Có, nếu bạn cần hiểu chất lượng nguồn đầu vào marketing hoặc đối chiếu submission với lead thực tế.',
      },
      {
        question: 'Nếu commission chưa lên ngay sau khi chốt đơn thì có phải lỗi không?',
        answer: 'Không hẳn. Cần kiểm tra trạng thái order, các bước bàn giao sau chốt và quy tắc ghi nhận hoa hồng trước khi kết luận.',
      },
    ],
  },
  [Role.ADSMANAGER]: {
    headline:
      'Ads manager can di theo nhip observe -> analyze -> adjust: xem dau hieu can xu ly trong Ads management, xac thuc bang profit trong Ads analytics, roi moi quay lai update group hoac chatbot settings.',
    stages: [
      {
        title: 'Dau ngay: quan sat dung cho',
        description: 'Khong nen lao vao sua ngay. Dau tien can xem nhom nao dang co van de ve chi phi, trang thai hoac tracking.',
        steps: [
          'Mo Ads management de doc account, group, chi phi va tab Viec can lam.',
          'Khoanh vung nhom can theo doi them trong ngay.',
          'Neu du lieu bat thuong, ghi lai de doi chieu o Ads analytics.',
        ],
        successSignal: 'Biet ro hom nay can xu ly nhom nao truoc va vi sao.',
        route: '/app/ads-management',
      },
      {
        title: 'Giua ngay: doc hieu qua theo loi nhuan',
        description: 'Ads analytics la noi xac nhan mot thay doi co hop ly hay khong, dua tren cohort profit va parent profit.',
        steps: [
          'Loc theo khoang ngay, platform va nhom can quyet dinh.',
          'Doc realized cohort de biet spend da tao ra doanh thu va loi nhuan thuc ra sao.',
          'Doc parent profit neu can truy ve chat luong nguon theo phu huynh.',
        ],
        successSignal: 'Co ly do ro rang truoc khi de xuat tang, giam hay dung nhom.',
        route: '/app/ads-analytics',
      },
      {
        title: 'Cuoi vong: canh lai tracking va chatbot',
        description: 'Sau khi co ket luan, moi quay lai cap nhat group hoac fanpage/chatbot settings cho dong bo.',
        steps: [
          'Sua group trong Ads management neu can doi budget, status hoac tracking keys.',
          'Vao Chatbot settings neu can doi fanpage, token gan hoac auto-reply.',
          'Kiem tra lai xem thay doi co anh huong den attribution va luong hoi thoai hay khong.',
        ],
        successSignal: 'Thay doi da duoc ghi nhan dung man hinh va khong lam vo attribution.',
        route: '/app/chatbot-settings',
      },
    ],
    pitfalls: [
      {
        title: 'Chi nhin spend ma khong nhin profit',
        detail: 'Neu chi thay chi phi tang ma khong doc cohort profit, de quyet dinh se de bi thieu ngu canh doanh thu thuc.',
      },
      {
        title: 'Sua nhom nhung quen tracking keys',
        detail: 'Tracking key khong dong bo voi nhom quang cao se lam meo attribution xuong chatbot, leads va parent-profit.',
      },
      {
        title: 'Doi fanpage ma khong doi chieu token gan',
        detail: 'Fanpage update xong nhung token OpenAI hoac ad account gan sai se dan den luong hoi thoai va bao cao bi lech.',
      },
    ],
    faq: [
      {
        question: 'Khi nao nen vao Ads management, khi nao nen vao Ads analytics?',
        answer: 'Ads management de quan sat va thao tac; Ads analytics de giai thich ly do va kiem chung hieu qua truoc khi thay doi.',
      },
      {
        question: 'Vi sao Ads manager thay duoc token gan nhung khong thay tab thu vien token?',
        answer: 'Thu vien token nhay cam van do Director quan ly. Ads manager chi duoc dung va gan lai cac token da co san trong he thong.',
      },
    ],
  },
};
