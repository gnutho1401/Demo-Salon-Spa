const { sql, connectDB } = require("../../config/db");

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
        status, service_date_time, duration_minutes, before_images, after_images,
        before_condition, after_result, procedure_steps, products_used,
        technician_notes, recommendations, internal_notes, created_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @customer_id, @appointment_id, @package_session_id, @service_id, @technician_id,
        @status, @service_date_time, @duration_minutes, @before_images, @after_images,
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
  async getNoteByAppointment(appointmentId, isAdmin = false) {
    const pool = await this.getPool();
    let result = await pool.request()
      .input("AppointmentId", sql.Int, appointmentId)
      .query(`
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
      `);

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
          result = await pool.request()
            .input("AppointmentId", sql.Int, appointmentId)
            .query(`
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
            `);
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
}

module.exports = new TreatmentNotesV2Service();
