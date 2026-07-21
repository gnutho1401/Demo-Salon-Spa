const { sql, connectDB } = require("../../config/db");
const { generateContent } = require("../../config/gemini");

class TreatmentNotesV2Service {
  async getPool() {
    return await connectDB();
  }

  // 1. Create Treatment Note (called automatically by Event Listener)
  async createNote(data, transaction = null) {
    const pool = await this.getPool();
    const {
      customerId,
      appointmentId,
      packageSessionId,
      serviceId,
      technicianId,
      status = "draft",
      serviceDateTime,
      durationMinutes,
      beforeImages = [],
      afterImages = [],
      detailedImages = [],
      beforeCondition = "",
      afterResult = "",
      procedureSteps = [],
      productsUsed = [],
      technicianNotes = "",
      recommendations = "",
      internalNotes = ""
    } = data;

    // Check exactly one constraint
    if (!appointmentId && !packageSessionId) {
      throw new Error("Either appointment_id or package_session_id must be specified.");
    }

    // Check if a treatment note for this appointment already exists to prevent duplicate insertion
    if (appointmentId) {
      const checkReq = transaction ? new sql.Request(transaction) : pool.request();
      const existing = await checkReq
        .input("ApptId", sql.Int, appointmentId)
        .query("SELECT id FROM TreatmentNotesV2 WHERE appointment_id = @ApptId");
      if (existing.recordset.length > 0) {
        return existing.recordset[0].id;
      }
    }

    // Dynamic duration lookup from Services table
    let finalDuration = durationMinutes;
    if (!finalDuration && serviceId) {
      const dbReq = transaction ? new sql.Request(transaction) : pool.request();
      const svcRes = await dbReq
        .input("SvcId", sql.Int, serviceId)
        .query("SELECT DurationMinutes FROM Services WHERE ServiceId = @SvcId");
      finalDuration = svcRes.recordset[0]?.DurationMinutes || 60;
    } else if (!finalDuration) {
      finalDuration = 60;
    }

    const request = transaction ? new sql.Request(transaction) : pool.request();
    request.input("customer_id", sql.Int, customerId);
    request.input("appointment_id", sql.Int, appointmentId || null);
    request.input("package_session_id", sql.UniqueIdentifier, packageSessionId || null);
    request.input("service_id", sql.Int, serviceId);
    request.input("technician_id", sql.Int, technicianId);
    request.input("status", sql.NVarChar(20), status);
    request.input("service_date_time", sql.DateTime, serviceDateTime);
    request.input("duration_minutes", sql.Int, finalDuration);
    request.input("before_images", sql.NVarChar(sql.MAX), JSON.stringify(beforeImages));
    request.input("after_images", sql.NVarChar(sql.MAX), JSON.stringify(afterImages));
    request.input("detailed_images", sql.NVarChar(sql.MAX), JSON.stringify(detailedImages));
    request.input("before_condition", sql.NVarChar(sql.MAX), beforeCondition);
    request.input("after_result", sql.NVarChar(sql.MAX), afterResult);
    request.input("procedure_steps", sql.NVarChar(sql.MAX), JSON.stringify(procedureSteps));
    request.input("products_used", sql.NVarChar(sql.MAX), JSON.stringify(productsUsed));
    request.input("technician_notes", sql.NVarChar(sql.MAX), technicianNotes);
    request.input("recommendations", sql.NVarChar(sql.MAX), recommendations);
    request.input("internal_notes", sql.NVarChar(sql.MAX), internalNotes);

    const result = await request.query(`
      INSERT INTO TreatmentNotesV2 (
        customer_id, appointment_id, package_session_id, service_id, technician_id,
        status, service_date_time, duration_minutes, before_images, after_images, detailed_images,
        before_condition, after_result, procedure_steps, products_used,
        technician_notes, recommendations, internal_notes, created_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @customer_id, @appointment_id, @package_session_id, @service_id, @technician_id,
        @status, @service_date_time, @duration_minutes, @before_images, @after_images, @detailed_images,
        @before_condition, @after_result, @procedure_steps, @products_used,
        @technician_notes, @recommendations, @internal_notes, GETDATE()
      )
    `);

    return result.recordset[0].id;
  }

  // 2. Get customer timeline history with optional search filters
  async getCustomerHistory(customerId, filters = {}, isAdmin = false) {
    const pool = await this.getPool();
    const { technicianId, serviceType, startDate, endDate, status } = filters;

    let query = `
      SELECT 
        tn.id,
        tn.customer_id,
        tn.appointment_id,
        tn.package_session_id,
        tn.service_id,
        tn.technician_id,
        tn.status,
        tn.service_date_time,
        tn.duration_minutes,
        tn.before_images,
        tn.after_images,
        tn.detailed_images,
        tn.before_condition,
        tn.after_result,
        tn.procedure_steps,
        tn.products_used,
        tn.technician_notes,
        tn.recommendations,
        ${isAdmin ? "tn.internal_notes," : ""}
        tn.follow_up_appointment_id,
        tn.created_at,
        s.ServiceName,
        s.Price AS ServicePrice,
        sc.CategoryName,
        u.FullName AS TechnicianName,
        u.AvatarUrl AS TechnicianAvatar
      FROM TreatmentNotesV2 tn
      JOIN Services s ON tn.service_id = s.ServiceId
      JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
      JOIN Employees e ON tn.technician_id = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      WHERE tn.customer_id = @CustomerId
    `;

    const request = pool.request();
    request.input("CustomerId", sql.Int, customerId);

    if (technicianId) {
      query += ` AND tn.technician_id = @TechnicianId`;
      request.input("TechnicianId", sql.Int, technicianId);
    }

    if (serviceType) {
      query += ` AND sc.CategoryName LIKE @ServiceType`;
      request.input("ServiceType", sql.NVarChar(50), `%${serviceType}%`);
    }

    if (startDate) {
      query += ` AND tn.service_date_time >= @StartDate`;
      request.input("StartDate", sql.DateTime, startDate);
    }

    if (endDate) {
      query += ` AND tn.service_date_time <= @EndDate`;
      request.input("EndDate", sql.DateTime, endDate);
    }

    if (status) {
      query += ` AND tn.status = @Status`;
      request.input("Status", sql.NVarChar(20), status);
    }

    query += ` ORDER BY tn.service_date_time DESC`;

    const result = await request.query(query);
    return result.recordset.map(row => this.formatNoteRow(row));
  }

  // 3a. Get treatment note by UUID (note ID)
  async getNoteById(noteId, isAdmin = false) {
    const pool = await this.getPool();
    const result = await pool.request()
      .input("NoteId", sql.UniqueIdentifier, noteId)
      .query(`
        SELECT
          tn.*,
          c.FullName AS CustomerName,
          s.ServiceName,
          s.Price AS ServicePrice,
          s.ImageUrl,
          sc.CategoryName,
          u.FullName AS TechnicianName,
          u.AvatarUrl AS TechnicianAvatar
        FROM TreatmentNotesV2 tn
        JOIN Customers cust ON tn.customer_id = cust.CustomerId
        JOIN Users c ON cust.UserId = c.UserId
        JOIN Services s ON tn.service_id = s.ServiceId
        JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
        JOIN Employees e ON tn.technician_id = e.EmployeeId
        JOIN Users u ON e.UserId = u.UserId
        WHERE tn.id = @NoteId
      `);

    if (result.recordset.length === 0) return null;
    const row = result.recordset[0];
    if (!isAdmin) delete row.internal_notes;
    return this.formatNoteRow(row);
  }

  // 3. Get treatment note detail for a specific appointment
  async getNoteByAppointment(appointmentId, serviceId = null, isAdmin = false) {
    const pool = await this.getPool();

    const runQuery = async () => {
      let query = `
        SELECT 
          tn.*,
          s.ServiceName,
          s.Price AS ServicePrice,
          s.ImageUrl,
          sc.CategoryName,
          u.FullName AS TechnicianName,
          u.AvatarUrl AS TechnicianAvatar
        FROM TreatmentNotesV2 tn
        JOIN Services s ON tn.service_id = s.ServiceId
        JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
        JOIN Employees e ON tn.technician_id = e.EmployeeId
        JOIN Users u ON e.UserId = u.UserId
        WHERE tn.appointment_id = @AppointmentId
      `;
      const req = pool.request().input("AppointmentId", sql.Int, appointmentId);
      if (serviceId) {
        query += ` AND tn.service_id = @ServiceId`;
        req.input("ServiceId", sql.Int, serviceId);
      }
      return await req.query(query);
    };

    let result = await runQuery();

    if (result.recordset.length === 0) {
      // Auto-create note if appointment is completed
      const apptCheck = await pool.request()
        .input("AppointmentId", sql.Int, appointmentId)
        .query(`SELECT Status FROM Appointments WHERE AppointmentId = @AppointmentId`);
      
      const appt = apptCheck.recordset[0];
      if (appt && appt.Status === 'COMPLETED') {
        try {
          await this.createNoteOnCompletion(appointmentId);
          // Query again
          result = await runQuery();
        } catch (e) {
          console.error("[AutoNoteGeneration] Failed to auto create note on get:", e);
        }
      }
    }

    if (result.recordset.length === 0) return null;
    const row = result.recordset[0];
    if (!isAdmin) {
      delete row.internal_notes;
    }
    return this.formatNoteRow(row);
  }

  // 4. Update Treatment Note (Only allowed if status = 'draft')
  async updateNote(id, updateFields, isAdmin = false) {
    const pool = await this.getPool();

    // Check status first
    const statusCheck = await pool.request()
      .input("id", sql.UniqueIdentifier, id)
      .query("SELECT status FROM TreatmentNotesV2 WHERE id = @id");

    if (statusCheck.recordset.length === 0) {
      throw new Error("Không tìm thấy ghi chú trị liệu.");
    }

    const currentStatus = statusCheck.recordset[0].Status || statusCheck.recordset[0].status;
    const isOnlyFollowUp = Object.keys(updateFields).every(k => k === "follow_up_appointment_id");

    if (currentStatus !== "draft" && !updateFields.follow_up_appointment_id) {
      throw new Error("Cannot edit a finalized treatment note.");
    }

    const setClauses = [];
    const request = pool.request();
    request.input("id", sql.UniqueIdentifier, id);

    const allowedFields = [
      "duration_minutes",
      "before_condition",
      "after_result",
      "technician_notes",
      "recommendations",
      "follow_up_appointment_id"
    ];

    if (isAdmin) {
      allowedFields.push("internal_notes");
    }

    allowedFields.forEach(field => {
      if (updateFields[field] !== undefined) {
        // If note is finalized, only allow updating follow_up_appointment_id
        if (currentStatus !== "draft" && field !== "follow_up_appointment_id") {
          return;
        }
        setClauses.push(`${field} = @${field}`);
        if (field === "duration_minutes" || field === "follow_up_appointment_id") {
          request.input(field, sql.Int, updateFields[field] ? Number(updateFields[field]) : null);
        } else {
          request.input(field, sql.NVarChar(sql.MAX), updateFields[field]);
        }
      }
    });

    if (updateFields.before_images !== undefined) {
      setClauses.push(`before_images = @before_images`);
      request.input("before_images", sql.NVarChar(sql.MAX), JSON.stringify(updateFields.before_images));
    }
    if (updateFields.after_images !== undefined) {
      setClauses.push(`after_images = @after_images`);
      request.input("after_images", sql.NVarChar(sql.MAX), JSON.stringify(updateFields.after_images));
    }
    if (updateFields.detailed_images !== undefined) {
      setClauses.push(`detailed_images = @detailed_images`);
      request.input("detailed_images", sql.NVarChar(sql.MAX), JSON.stringify(updateFields.detailed_images));
    }
    if (updateFields.procedure_steps !== undefined) {
      setClauses.push(`procedure_steps = @procedure_steps`);
      request.input("procedure_steps", sql.NVarChar(sql.MAX), JSON.stringify(updateFields.procedure_steps));
    }
    if (updateFields.products_used !== undefined) {
      setClauses.push(`products_used = @products_used`);
      request.input("products_used", sql.NVarChar(sql.MAX), JSON.stringify(updateFields.products_used));
    }

    if (setClauses.length === 0) return false;

    setClauses.push("updated_at = GETDATE()");

    await request.query(`
      UPDATE TreatmentNotesV2
      SET ${setClauses.join(", ")}
      WHERE id = @id
    `);

    return true;
  }

  // 5. Lock/Finalize Treatment Note
  async finalizeNote(id) {
    const pool = await this.getPool();
    const result = await pool.request()
      .input("id", sql.UniqueIdentifier, id)
      .query(`
        UPDATE TreatmentNotesV2
        SET status = 'finalized', updated_at = GETDATE()
        WHERE id = @id AND status = 'draft'
      `);

    return result.rowsAffected[0] > 0;
  }

  // 5b. Link follow-up appointment to a treatment note (called when KTV books PENDING re-visit)
  async linkFollowUpAppointment(noteId, followUpAppointmentId) {
    const pool = await this.getPool();
    await pool.request()
      .input("id", sql.UniqueIdentifier, noteId)
      .input("follow_up_appointment_id", sql.Int, followUpAppointmentId)
      .query(`
        UPDATE TreatmentNotesV2
        SET follow_up_appointment_id = @follow_up_appointment_id, updated_at = GETDATE()
        WHERE id = @id
      `);
    return true;
  }

  // 5c. Finalize the treatment note linked to a follow-up appointment (called when customer confirms)
  async finalizeByFollowUpAppointment(appointmentId) {
    const pool = await this.getPool();
    const result = await pool.request()
      .input("follow_up_appointment_id", sql.Int, appointmentId)
      .query(`
        UPDATE TreatmentNotesV2
        SET status = 'finalized', updated_at = GETDATE()
        WHERE follow_up_appointment_id = @follow_up_appointment_id
          AND status = 'draft'
      `);
    return result.rowsAffected[0] > 0;
  }

  // 6. Global Search + Filtering (Analytics-ready & Search endpoints)
  async searchNotes(filters = {}, isAdmin = false) {
    const pool = await this.getPool();
    const { keyword, technicianId, status, serviceId, customerId } = filters;

    let query = `
      SELECT 
        tn.*,
        c.FullName AS CustomerName,
        s.ServiceName,
        s.ImageUrl,
        sc.CategoryName,
        u.FullName AS TechnicianName,
        u.AvatarUrl AS TechnicianAvatar,
        a.Status AS AppointmentStatus,
        a.Notes AS AppointmentNotes
      FROM TreatmentNotesV2 tn
      LEFT JOIN Appointments a ON tn.appointment_id = a.AppointmentId
      JOIN Customers cust ON tn.customer_id = cust.CustomerId
      JOIN Users c ON cust.UserId = c.UserId
      JOIN Services s ON tn.service_id = s.ServiceId
      JOIN ServiceCategories sc ON s.CategoryId = sc.CategoryId
      JOIN Employees e ON tn.technician_id = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      WHERE 1=1
    `;

    const request = pool.request();

    if (customerId) {
      query += ` AND tn.customer_id = @CustomerId`;
      request.input("CustomerId", sql.Int, customerId);
    }
    if (technicianId) {
      query += ` AND tn.technician_id = @TechnicianId`;
      request.input("TechnicianId", sql.Int, technicianId);
    }
    if (serviceId) {
      query += ` AND tn.service_id = @ServiceId`;
      request.input("ServiceId", sql.Int, serviceId);
    }
    if (status) {
      query += ` AND tn.status = @Status`;
      request.input("Status", sql.NVarChar(20), status);
    }
    if (keyword) {
      query += ` AND (tn.technician_notes LIKE @Keyword 
                 OR tn.recommendations LIKE @Keyword 
                 OR tn.before_condition LIKE @Keyword 
                 OR tn.after_result LIKE @Keyword)`;
      request.input("Keyword", sql.NVarChar(100), `%${keyword}%`);
    }

    query += ` ORDER BY tn.service_date_time DESC`;

    const result = await request.query(query);
    return result.recordset.map(row => {
      const note = this.formatNoteRow(row);
      if (!isAdmin) {
        delete note.internal_notes;
      }
      return note;
    });
  }

  // 7. Analytics Data structures
  async getAnalytics() {
    const pool = await this.getPool();
    const techPerformance = await pool.request().query(`
      SELECT 
        u.FullName AS TechnicianName,
        COUNT(tn.id) AS CompletedNotes,
        AVG(tn.duration_minutes) AS AvgDurationMinutes
      FROM TreatmentNotesV2 tn
      JOIN Employees e ON tn.technician_id = e.EmployeeId
      JOIN Users u ON e.UserId = u.UserId
      WHERE tn.status = 'finalized'
      GROUP BY u.FullName
    `);

    const serviceStats = await pool.request().query(`
      SELECT 
        s.ServiceName,
        COUNT(tn.id) AS TotalPerformances
      FROM TreatmentNotesV2 tn
      JOIN Services s ON tn.service_id = s.ServiceId
      GROUP BY s.ServiceName
    `);

    return {
      technicianPerformance: techPerformance.recordset,
      servicePopularity: serviceStats.recordset
    };
  }

  // Helper method to deserialize JSON arrays and objects safely
  formatNoteRow(row) {
    if (!row) return null;
    return {
      ...row,
      before_images: this.safeParseJson(row.before_images, []),
      after_images: this.safeParseJson(row.after_images, []),
      detailed_images: this.safeParseJson(row.detailed_images, []),
      procedure_steps: this.safeParseJson(row.procedure_steps, []),
      products_used: this.safeParseJson(row.products_used, [])
    };
  }

  safeParseJson(str, fallback) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  // Auto create Treatment Note when appointment status transitions to COMPLETED
  async createNoteOnCompletion(appointmentId) {
    // 1. Check if note already exists
    const pool = await this.getPool();
    const noteCheck = await pool.request()
      .input("AppointmentId", sql.Int, appointmentId)
      .query(`SELECT id FROM TreatmentNotesV2 WHERE appointment_id = @AppointmentId`);
      
    if (noteCheck.recordset.length > 0) {
      console.log(`[EventBus] TreatmentNote V2 already exists for appointment ${appointmentId}`);
      return noteCheck.recordset[0].id;
    }

    // 2. Query appointment details
    const apptResult = await pool.request()
      .input("AppointmentId", sql.Int, appointmentId)
      .query(`
        SELECT 
          a.CustomerId, 
          a.EmployeeId, 
          a.AppointmentDate, 
          a.StartTime, 
          a.CustomerPackageId
        FROM Appointments a
        WHERE a.AppointmentId = @AppointmentId
      `);

    const appt = apptResult.recordset[0];
    if (!appt) {
      throw new Error(`Appointment ${appointmentId} not found`);
    }

    // 3. Query primary service ID
    const svcResult = await pool.request()
      .input("AppointmentId", sql.Int, appointmentId)
      .query(`
        SELECT TOP 1 ServiceId 
        FROM AppointmentServices 
        WHERE AppointmentId = @AppointmentId
      `);
      
    const serviceId = svcResult.recordset[0]?.ServiceId;
    if (!serviceId) {
      throw new Error(`No services found for appointment ${appointmentId}`);
    }

    // 4. Handle package flow if CustomerPackageId exists
    let packageSessionId = null;
    if (appt.CustomerPackageId) {
      // Find or create PackageSession
      const sessionResult = await pool.request()
        .input("AppointmentId", sql.Int, appointmentId)
        .query(`SELECT id FROM PackageSessions WHERE linked_appointment_id = @AppointmentId`);

      if (sessionResult.recordset.length > 0) {
        packageSessionId = sessionResult.recordset[0].id;
      } else {
        // Calculate session index
        const countResult = await pool.request()
          .input("CustomerPackageId", sql.Int, appt.CustomerPackageId)
          .query(`
            SELECT COUNT(*) AS count 
            FROM PackageSessions 
            WHERE package_id = @CustomerPackageId AND status = 'used'
          `);
        const sessionIndex = (countResult.recordset[0]?.count || 0) + 1;

        // Insert PackageSession
        const insertSessionRes = await pool.request()
          .input("customer_package_id", sql.Int, appt.CustomerPackageId)
          .input("customer_id", sql.Int, appt.CustomerId)
          .input("service_id", sql.Int, serviceId)
          .input("session_index", sql.Int, sessionIndex)
          .input("linked_appointment_id", sql.Int, appointmentId)
          .query(`
            INSERT INTO PackageSessions (package_id, customer_id, service_id, status, linked_appointment_id, created_at)
            OUTPUT INSERTED.id
            VALUES (@customer_package_id, @customer_id, @service_id, 'used', @linked_appointment_id, GETDATE())
          `);
        packageSessionId = insertSessionRes.recordset[0].id;
      }
    }

    // Format local date part safely
    const dObj = new Date(appt.AppointmentDate);
    const year = dObj.getFullYear();
    const month = String(dObj.getMonth() + 1).padStart(2, "0");
    const day = String(dObj.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;

    // Get time part safely without timezone offset shifting
    let timeStr = "10:00:00";
    if (appt.StartTime instanceof Date) {
      const h = String(appt.StartTime.getUTCHours()).padStart(2, "0");
      const m = String(appt.StartTime.getUTCMinutes()).padStart(2, "0");
      const s = String(appt.StartTime.getUTCSeconds()).padStart(2, "0");
      timeStr = `${h}:${m}:${s}`;
    } else if (typeof appt.StartTime === "string") {
      const matches = appt.StartTime.match(/(\d{2}):(\d{2})/);
      if (matches) {
        timeStr = `${matches[1]}:${matches[2]}:00`;
      }
    }
    const serviceDateTimeStr = `${dateStr} ${timeStr}`;

    // 5. Create draft Treatment Note V2
    const noteId = await this.createNote({
      customerId: appt.CustomerId,
      appointmentId: appointmentId,
      packageSessionId: packageSessionId,
      serviceId: serviceId,
      technicianId: appt.EmployeeId,
      status: "draft",
      serviceDateTime: serviceDateTimeStr
    });

    return noteId;
  }

  // 6. Generate AI notes from raw inputs
  async generateAINote(rawText, serviceName, categoryName) {
    if (!rawText) throw new Error("Ghi chú thô không được để trống");
    if (!serviceName) throw new Error("Tên dịch vụ không được để trống");

    const systemPrompt = `Bạn là một trợ lý AI thẩm mỹ chuyên nghiệp tại Beauty Salon. 
Nhiệm vụ của bạn là phân tích các từ khóa hoặc văn bản ghi chú thô của kỹ thuật viên (KTV) và tên dịch vụ được thực hiện để sinh ra một ghi chú điều trị chi tiết, chuyên nghiệp, lịch sự bằng tiếng Việt.
Bạn phải trả về kết quả dưới dạng JSON duy nhất. KHÔNG thêm bất kỳ văn bản nào bên ngoài JSON.

Cấu trúc JSON cần trả về:
{
  "before_condition": "Tình trạng chi tiết của móng/da/tóc trước khi thực hiện dịch vụ (mô tả lịch sự, chuyên sâu).",
  "after_result": "Kết quả thẩm mỹ chi tiết sau khi hoàn thành dịch vụ (mô tả bóng đẹp, bền chắc, khỏe mạnh).",
  "technician_notes": "Quan sát lâm sàng, ghi chú sở thích đặc biệt của khách hàng (ví dụ: thích phom oval, màu pastel nhạt, da nhạy cảm).",
  "procedure_steps": [
    "Bước 1:...",
    "Bước 2:...",
    "Bước 3:..."
  ],
  "products_used": [
    { "name": "Tên sản phẩm", "desc": "Mô tả sản phẩm và cách dùng trong dịch vụ này" }
  ],
  "recommendations": "Các khuyến nghị tự chăm sóc chi tiết tại nhà, các câu cách nhau bằng dấu chấm phẩy (;).",
  "suggested_follow_up_days": 14,
  "suggested_follow_up_reason": "Lý do hẹn khách hàng quay lại tái khám hoặc làm mới dịch vụ."
}

Hãy tham chiếu Danh mục sản phẩm theo thể loại dịch vụ dưới đây để đưa vào "products_used" một cách hợp lý:
- Nail: Son gel OPI - Bubble Bath (Hồng pastel), Son gel OPI - Malaga Wine (Đỏ burgundy), Son gel OPI - Lincoln Park (Đen xanh), Top Coat OPI - Bóng cao cấp, Base Coat OPI - Bảo vệ móng, Dầu dưỡng móng OPI - Nail Oil, Acetone tẩy sơn chuyên dụng, Dũa móng điện chuyên nghiệp, Keo nail art - Gel trong, Bột acrylic - Trắng/Hồng, Đèn UV/LED gel.
- Massage: Tinh dầu Lavender thư giãn, Tinh dầu Peppermint giảm đau, Tinh dầu Eucalyptus thông mũi, Tinh dầu Lemon sảng khoái, Đá bazan trị liệu nóng 55°C, Kem massage Deep Tissue, Dầu dừa hữu cơ nguyên chất, Gel lạnh giảm sưng viêm, Muối Himalaya ngâm chân, Khăn nóng thảo dược.
- Waxing: Sáp wax mật ong (da nhạy cảm), Sáp wax chocolate (da thường), Sáp wax lavender (da khô), Phấn rôm chuẩn bị da, Dầu after-wax dịu nhẹ, Kem làm dịu sau wax Aloe Vera, Băng wax vải cotton, Nước tẩy trang trước wax.
- Facial: Sữa rửa mặt CeraVe dịu nhẹ, Toner Klairs - Cân bằng độ ẩm, Serum Vitamin C - Làm sáng da, Serum Hyaluronic Acid - Cấp ẩm, Retinol - Tái tạo tế bào, Kem dưỡng ẩm SPF50+, Mặt nạ đất sét - Kiểm soát dầu, Mặt nạ collagen - Căng bóng, Kem tẩy tế bào chết enzyme, Nước cân bằng pH da, Máy siêu âm đẩy dưỡng chất.
- Hair: Dầu gội Kerastase dưỡng tóc, Dầu xả Kerastase phục hồi, Kem ủ tóc collagen, Serum dưỡng tóc Argan Oil, Thuốc nhuộm tóc Loreal, Oxy nhuộm 20Vol / 30Vol, Thuốc uốn/duỗi ceramic, Keo tạo kiểu giữ nếp, Xịt dưỡng nhiệt bảo vệ tóc.
- Spa: Muối khoáng tắm khoáng, Sữa tắm dưỡng thể hoa hồng, Tẩy tế bào chết body cà phê, Kem body butter dưỡng ẩm sâu, Mặt nạ bùn khoáng, Viên bom tắm thư giãn, Tinh dầu xông hơi, Trà thảo mộc detox.
- Khác: Dung dịch vệ sinh chuyên dụng, Kem dưỡng ẩm đa năng, Bông tẩy trang y tế, Cồn 70° khử trùng dụng cụ, Găng tay y tế vô trùng, Khăn giấy cao cấp.

LƯU Ý quan trọng:
- Trả về định dạng JSON thuần túy, hợp lệ.
- Hãy cố gắng lấy từ khóa thô của KTV làm trọng tâm để điền thông tin phù hợp nhất.`;

    const userMessage = `Dịch vụ thực hiện: "${serviceName}"
Thể loại dịch vụ: "${categoryName || "Chung"}"
Ghi chú thô của kỹ thuật viên: "${rawText}"`;

    try {
      const response = await generateContent(systemPrompt, userMessage, { jsonMode: true });
      try {
        return JSON.parse(response);
      } catch (parseErr) {
        const match = response.match(/\{[\s\S]*\}/);
        if (match) {
          return JSON.parse(match[0]);
        }
        throw parseErr;
      }
    } catch (err) {
      console.warn("[AI generateAINote] API failed, using smart local template fallback:", err.message);
      const category = (categoryName || serviceName || "default").toLowerCase();
      let fallbackData;

      if (category.includes("nail") || category.includes("móng") || category.includes("gel") || category.includes("sơn")) {
        fallbackData = {
          before_condition: "Bề mặt móng hơi khô ráp, da quanh viền móng có vết xước nhẹ, chất móng mỏng và yếu.",
          after_result: "Móng được dũa tạo phom oval cân đối, sơn gel mịn màng, lên màu đều đẹp và khóa bóng bền bỉ.",
          technician_notes: "Khách hàng ưu tiên phom móng ngắn oval tự nhiên, thích màu hồng thạch nhẹ nhàng nữ tính.",
          procedure_steps: [
            "Khử trùng tay khách hàng và dụng cụ làm móng",
            "Dũa phom móng oval theo sở thích của khách",
            "Làm mềm da và tiến hành nhặt da chết quanh móng",
            "Sơn 1 lớp Base Coat bảo vệ móng thật và hơ đèn 60s",
            "Sơn 2 lớp màu sơn gel thạch màu hồng nhẹ nhàng",
            "Sơn phủ bóng bảo vệ màu sơn Top Coat bóng và hơ đèn 60s",
            "Thoa dầu dưỡng biểu bì OPI quanh móng kết hợp massage tay"
          ],
          products_used: [
            { name: "Son gel OPI - Bubble Bath", desc: "Màu sơn hồng thạch bóng mịn tự nhiên" },
            { name: "Base Coat OPI", desc: "Lót liên kết bảo vệ bề mặt móng" },
            { name: "Top Coat OPI", desc: "Khóa màu bảo vệ độ bền sơn gel" },
            { name: "Dầu dưỡng móng OPI - Nail Oil", desc: "Dưỡng chất phục hồi da quanh móng và chất móng" }
          ],
          recommendations: "Bôi dầu dưỡng móng OPI mỗi tối; Đeo găng tay khi rửa chén hoặc tiếp xúc chất tẩy rửa mạnh; Tránh tự ý cạy lớp sơn gel; Hẹn quay lại tiệm sau 3 tuần",
          suggested_follow_up_days: 21,
          suggested_follow_up_reason: "Quay lại tháo gel cũ, chăm sóc phục hồi móng và dũa lại phom móng"
        };
      } else if (category.includes("massage") || category.includes("body") || category.includes("thư giãn") || category.includes("đá nóng")) {
        fallbackData = {
          before_condition: "Cơ bắp vùng vai gáy và thắt lưng bị căng cứng nhiều do thói quen ngồi làm việc lâu.",
          after_result: "Các vùng cơ căng mỏi được xoa dịu hoàn toàn, khách hàng thấy cơ thể nhẹ nhõm, dễ chịu.",
          technician_notes: "Khách hàng thích lực massage vừa phải, tập trung sâu vào vùng cơ thang vai trái.",
          procedure_steps: [
            "Cho khách ngâm chân thảo dược nước ấm đào thải độc tố",
            "Bấm huyệt khai thông kinh lạc vùng lưng vai",
            "Thoa tinh dầu oải hương massage giải cơ sâu vùng lưng, bả vai và cổ",
            "Chườm đá nóng Bazan 55 độ giúp giãn cơ sâu và tăng tuần hoàn máu",
            "Massage đầu vai gáy thư giãn kết thúc liệu trình"
          ],
          products_used: [
            { name: "Tinh dầu Lavender", desc: "Tinh dầu thảo mộc giúp thư giãn và giảm đau mỏi" },
            { name: "Đá bazan trị liệu", desc: "Đá nóng 55 độ giữ nhiệt xoa dịu cơ co cứng" }
          ],
          recommendations: "Uống 1 ly nước ấm ngay sau massage để hỗ trợ đào thải độc tố; Tránh tắm nước lạnh trong vòng 4 tiếng tới; Thực hiện các bài tập kéo giãn cơ vai nhẹ nhàng hàng ngày",
          suggested_follow_up_days: 7,
          suggested_follow_up_reason: "Massage giải cơ sâu duy trì phục hồi sức khỏe lưng vai gáy định kỳ"
        };
      } else if (category.includes("facial") || category.includes("da") || category.includes("mặt") || category.includes("mụn")) {
        fallbackData = {
          before_condition: "Làn da thiếu ẩm, xỉn màu vùng chữ T, có mụn cám và sợi bã nhờn rải rác.",
          after_result: "Da ẩm mượt, căng mịn, lỗ chân lông thông thoáng và sáng đều màu hơn.",
          technician_notes: "Khách hàng sở hữu da hỗn hợp thiên dầu vùng chữ T, nhạy cảm nhẹ. Khuyên dùng sữa rửa mặt dịu nhẹ.",
          procedure_steps: [
            "Tẩy trang nhẹ nhàng và rửa mặt bằng sữa rửa mặt CeraVe",
            "Tẩy tế bào chết bằng enzyme dịu nhẹ để loại bỏ sừng hóa",
            "Xông hơi ấm kết hợp hút sạch bã nhờn, mụn cám",
            "Thoa serum Hyaluronic Acid kết hợp máy siêu âm đẩy dưỡng chất sâu",
            "Đắp mặt nạ collagen căng bóng cấp ẩm sâu và làm dịu da",
            "Thoa kem dưỡng ẩm bảo vệ da"
          ],
          products_used: [
            { name: "Sữa rửa mặt CeraVe dịu nhẹ", desc: "Làm sạch sâu da nhẹ nhàng" },
            { name: "Serum Hyaluronic Acid - Cấp ẩm", desc: "Giữ ẩm và ngậm nước cho tế bào da" },
            { name: "Mặt nạ collagen - Căng bóng", desc: "Cấp ẩm làm căng mịn săn chắc da" }
          ],
          recommendations: "Duy trì thoa kem chống nắng SPF50+ hàng ngày; Uống đủ 2 lít nước mỗi ngày; Sử dụng kem dưỡng ẩm đều đặn sáng tối; Đắp mặt nạ cấp ẩm 2 lần/tuần tại nhà",
          suggested_follow_up_days: 14,
          suggested_follow_up_reason: "Tiếp tục liệu trình chăm sóc da chuyên sâu cấp ẩm phục hồi da"
        };
      } else if (category.includes("hair") || category.includes("tóc") || category.includes("uốn") || category.includes("gội")) {
        fallbackData = {
          before_condition: "Thân tóc xơ rối, ngọn tóc chẻ ngọn do uốn nhuộm hóa chất cũ, da đầu có nhiều gàu nhẹ.",
          after_result: "Tóc mềm mượt, suôn bóng và da đầu sạch thoáng nhẹ nhàng.",
          technician_notes: "Tóc yếu và xơ nhiều phần đuôi. Tư vấn khách hàng dùng thêm kem ủ phục hồi Keratin.",
          procedure_steps: [
            "Gội đầu 2 lần bằng dầu gội phục hồi Kerastase loại bỏ bụi bẩn dầu thừa",
            "Massage bấm huyệt da đầu kích thích mọc tóc",
            "Thoa kem ủ tóc Collagen hấp nóng phục hồi trong 15 phút",
            "Xả sạch, lau khô, thoa tinh dầu Argan dưỡng bóng và sấy tạo kiểu nhẹ"
          ],
          products_used: [
            { name: "Dầu gội Kerastase phục hồi", desc: "Tái tạo liên kết sợi tóc bị đứt gãy" },
            { name: "Kem ủ tóc collagen", desc: "Bổ sung độ ẩm sâu cho tóc suôn mềm" },
            { name: "Serum dưỡng tóc Argan Oil", desc: "Bảo vệ ngọn tóc khỏi xơ và chẻ ngọn" }
          ],
          recommendations: "Tránh gội đầu bằng nước quá nóng; Dùng dầu xả ở phần đuôi tóc sau khi gội; Thoa serum bảo vệ ngọn tóc trước khi sấy; Ủ tóc tại nhà 1 lần/tuần",
          suggested_follow_up_days: 14,
          suggested_follow_up_reason: "Hấp dầu dưỡng chất và gội đầu dưỡng sinh phục hồi tóc định kỳ"
        };
      } else {
        fallbackData = {
          before_condition: "Tình trạng bình thường trước khi tiến hành dịch vụ chăm sóc.",
          after_result: "Dịch vụ hoàn tất tốt đẹp, đạt yêu cầu kỹ thuật và thẩm mỹ của salon.",
          technician_notes: "Khách hàng hài lòng với thái độ chu đáo và tay nghề của kỹ thuật viên.",
          procedure_steps: [
            "Chuẩn bị giường và dụng cụ sạch sẽ vô trùng",
            "Thực hiện quy trình dịch vụ kỹ thuật tiêu chuẩn của Luna Salon",
            "Vệ sinh sạch sẽ vùng điều trị và thoa dưỡng chất dưỡng ẩm bảo vệ da"
          ],
          products_used: [
            { name: "Sản phẩm chuyên dụng Luna Salon", desc: "Lành tính và dịu nhẹ cho mọi loại da/móng" }
          ],
          recommendations: "Chăm sóc tại nhà theo hướng dẫn cơ bản; Thoa kem dưỡng ẩm đầy đủ; Tránh ánh nắng mặt trời trực tiếp trong 24 giờ",
          suggested_follow_up_days: 14,
          suggested_follow_up_reason: "Tái khám chăm sóc duy trì kết quả thẩm mỹ tối ưu"
        };
      }

      fallbackData.is_fallback = true;
      return fallbackData;
    }
  }

  // 7. Get AI customer insights
  async getCustomerAIInsights(customerId) {
    const pool = await this.getPool();
    const id = Number(customerId);

    // Get customer profile
    const profileRes = await pool.request()
      .input("CustomerId", sql.Int, id)
      .query(`
        SELECT c.CustomerId, u.FullName, u.Email, u.Phone, c.Gender, c.DateOfBirth, c.LoyaltyPoints,
               ISNULL(ml.LevelName, 'Normal') AS MembershipLevel
        FROM Customers c
        JOIN Users u ON c.UserId = u.UserId
        LEFT JOIN MembershipLevels ml ON c.MembershipLevelId = ml.MembershipLevelId
        WHERE c.CustomerId = @CustomerId
      `);
    const customer = profileRes.recordset[0];
    if (!customer) throw new Error("Không tìm thấy thông tin khách hàng");

    // Get active packages
    const pkgsRes = await pool.request()
      .input("CustomerId", sql.Int, id)
      .query(`
        SELECT cp.CustomerPackageId, p.PackageName, cp.RemainingSessions, cp.Status
        FROM CustomerPackages cp
        JOIN Packages p ON cp.PackageId = p.PackageId
        WHERE cp.CustomerId = @CustomerId AND cp.Status IN ('ACTIVE', 'PENDING_PAYMENT') AND cp.RemainingSessions > 0
      `);
    const packages = pkgsRes.recordset;

    // Get recent treatment notes
    const notesRes = await pool.request()
      .input("CustomerId", sql.Int, id)
      .query(`
        SELECT TOP 5 tn.id, tn.service_date_time, s.ServiceName, tn.before_condition, tn.after_result, tn.technician_notes, tn.recommendations
        FROM TreatmentNotesV2 tn
        JOIN Services s ON tn.service_id = s.ServiceId
        WHERE tn.customer_id = @CustomerId AND tn.status = 'finalized'
        ORDER BY tn.service_date_time DESC
      `);
    const historyNotes = notesRes.recordset;

    // Get available services for follow-up suggestions
    const servicesRes = await pool.request()
      .query("SELECT ServiceId, ServiceName FROM Services WHERE Status = 'AVAILABLE' ORDER BY ServiceName");
    const availableServices = servicesRes.recordset;

    const servicesListStr = availableServices.map(s => `- [ID: ${s.ServiceId}] ${s.ServiceName}`).join("\n");
    const historyNotesStr = historyNotes.length > 0
      ? historyNotes.map(n => `Ngày: ${new Date(n.service_date_time).toLocaleDateString("vi-VN")} | Dịch vụ: ${n.ServiceName}\n- Tình trạng trước: ${n.before_condition}\n- Kết quả sau: ${n.after_result}\n- Ghi chú: ${n.technician_notes}\n- Khuyên dưỡng: ${n.recommendations}`).join("\n\n")
      : "Chưa có lịch sử điều trị hoàn thành.";
    const packagesStr = packages.length > 0
      ? packages.map(p => `- Gói: ${p.PackageName} (Còn ${p.RemainingSessions} buổi)`).join("\n")
      : "Không có gói combo hoạt động.";

    const systemPrompt = `Bạn là một Trợ lý AI Phân tích Khách hàng cao cấp (AI Advisor VIP) tại Beauty Salon.
Nhiệm vụ của bạn là đọc thông tin cá nhân, gói dịch vụ sở hữu và lịch sử ghi chú điều trị của khách hàng để tạo ra bản phân tích thông tin chăm sóc VIP.
Bạn phải trả về kết quả dưới dạng một đối tượng JSON hợp lệ duy nhất, có cấu trúc như sau:

{
  "reportMarkdown": "Bản báo cáo phân tích chi tiết bằng Markdown tiếng Việt. Gồm các tiêu đề: \\n### ⚠️ CẢNH BÁO VIP & LƯU Ý KỸ THUẬT\\n(Nói về dị ứng, nhạy cảm lực massage, sở thích phom dáng/màu sắc... dựa trên ghi chú cũ)\\n\\n### 📈 TIẾN TRÌNH & KẾ HOẠCH TRỊ LIỆU\\n(Tóm tắt tiến trình sức khỏe móng/da/tóc, tư vấn liệu trình phù hợp, tận dụng các gói combo đang có)\\n\\n### 🛍 ĐỀ XUẤT UP-SELL & SẢN PHẨM RETAIL\\n(Các dịch vụ nâng cao hoặc combo nên chốt lần tới, các sản phẩm bán lẻ chăm sóc tại nhà phù hợp tình trạng khách)",
  "suggestedFollowUp": {
    "serviceId": 12,
    "serviceName": "Tên dịch vụ đề xuất",
    "daysFromNow": 21,
    "notes": "Ghi chú ngắn gọn lý do hẹn tái khám"
  }
}

LƯU Ý quan trọng về đề xuất hẹn tái khám (suggestedFollowUp):
- Dịch vụ đề xuất (serviceId và serviceName) BẮT BUỘC phải khớp hoàn toàn với một trong các dịch vụ khả dụng trong danh sách dịch vụ dưới đây.
- Số ngày tái khám (daysFromNow) là một số nguyên dương đại diện cho khoảng cách ngày tối ưu (ví dụ: làm móng gel thì khoảng 21 ngày, massage body khoảng 7-14 ngày, facial khoảng 14 ngày).
- KHÔNG thêm bất cứ văn bản giải thích nào ngoài đối tượng JSON.

Danh sách dịch vụ khả dụng tại salon:
${servicesListStr}`;

    const userMessage = `Khách hàng: ${customer.FullName} (${customer.Gender === 'FEMALE' ? 'Nữ' : 'Nam'}, sinh năm ${customer.DateOfBirth ? new Date(customer.DateOfBirth).getFullYear() : 'chưa rõ'})
Hạng thành viên: ${customer.MembershipLevel} | Điểm tích lũy: ${customer.LoyaltyPoints}
Gói combo đang sở hữu:
${packagesStr}

Lịch sử ghi chú điều trị gần đây:
${historyNotesStr}`;

    try {
      const response = await generateContent(systemPrompt, userMessage, { jsonMode: true });
      try {
        return JSON.parse(response);
      } catch (parseErr) {
        const match = response.match(/\{[\s\S]*\}/);
        if (match) {
          return JSON.parse(match[0]);
        }
        throw parseErr;
      }
    } catch (err) {
      console.warn("[AI getCustomerAIInsights] API failed, using database stats fallback:", err.message);
      const genderStr = customer.Gender === 'FEMALE' ? 'Nữ' : 'Nam';
      const pkgsStrList = packages.length > 0
        ? packages.map(p => `- **Gói: ${p.PackageName}** (Còn ${p.RemainingSessions} buổi)`).join("\n")
        : "- Không có gói combo hoạt động nào.";
      
      const lastNoteText = historyNotes.length > 0
        ? historyNotes.map(n => `- **Ngày ${new Date(n.service_date_time).toLocaleDateString("vi-VN")} | ${n.ServiceName}**:\n  + Tình trạng trước: *${n.before_condition}*\n  + Kết quả sau: *${n.after_result}*\n  + Lời khuyên KTV: *${n.recommendations}*`).join("\n")
        : "- Chưa có lịch sử điều trị hoàn thành trước đây.";

      // Suggest follow up based on last service or first service in list
      const fallbackSvc = availableServices[0] || { ServiceId: 1, ServiceName: "Chăm sóc cơ bản" };
      
      const fallbackMarkdown = `### ⚠️ CẢNH BÁO VIP & LƯU Ý KỸ THUẬT (Mẫu hệ thống)
- **Thông tin khách hàng:** Khách hàng **${customer.FullName}** (${genderStr}) | Hạng thành viên: **${customer.MembershipLevel}** (Tích lũy: **${customer.LoyaltyPoints}** điểm).
- **Lưu ý đặc biệt:** Đọc kỹ ghi chú của các lần thực hiện trước. Đối với khách hàng có hạng thành viên cao (Gold/VIP), luôn chuẩn bị khăn ấm và trà thảo mộc phục vụ chu đáo. Kiểm tra kích ứng sản phẩm nếu khách hàng làm dịch vụ mới.

### 📈 TIẾN TRÌNH & KẾ HOẠCH TRỊ LIỆU (Mẫu hệ thống)
- **Gói Combo hiện tại:** 
${pkgsStrList}
- **Lịch sử ghi chú gần đây:**
${lastNoteText}
- **Định hướng chăm sóc:** Bám sát liệu trình theo đúng gói combo đã đăng ký để duy trì kết quả thẩm mỹ và phục hồi tốt nhất.

### 🛍 ĐỀ XUẤT UP-SELL & SẢN PHẨM RETAIL (Mẫu hệ thống)
- **Gợi ý dịch vụ:** Đề xuất nâng cấp lên gói liệu trình Facial cấp ẩm sâu hoặc Massage Đá Nóng để phục hồi cơ thể toàn diện.
- **Sản phẩm chăm sóc tại nhà:** Tư vấn sử dụng Dầu dưỡng móng OPI (đối với Nail) hoặc Serum dưỡng da Klairs/CeraVe (đối với Facial) để giữ ẩm tối ưu tại nhà.`;

      return {
        reportMarkdown: fallbackMarkdown,
        suggestedFollowUp: {
          serviceId: fallbackSvc.ServiceId,
          serviceName: fallbackSvc.ServiceName,
          daysFromNow: 14,
          notes: `Tái khám định kỳ đề xuất từ hệ thống cho khách hàng ${customer.FullName}`
        },
        is_fallback: true
      };
    }
  }
}

module.exports = new TreatmentNotesV2Service();
