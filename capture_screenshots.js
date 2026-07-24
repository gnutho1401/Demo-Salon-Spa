/**
 * Playwright screenshot script for SalonSpa report
 * Run: node capture_screenshots.js
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = 'H:\\a_SWP\\Demo-Salon-Spa\\report_screenshots';
const BASE_URL = 'http://localhost:5173';

const CREDENTIALS = {
  customer: { email: 'customer@salon.com', password: '123456' },
  receptionist: { email: 'receptionist1@salon.com', password: '123456' },
  technician: { email: 'technician@salon.com', password: '123456' },
  admin: { email: 'admin@salon.com', password: '123456' },
};

async function screenshot(page, name, description) {
  const filePath = path.join(OUTPUT_DIR, `${name}.png`);
  try {
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`OK ${name} - ${description}`);
    return filePath;
  } catch (e) {
    console.log(`FAIL ${name} - ERROR: ${e.message}`);
    return null;
  }
}

async function login(page, role) {
  const cred = CREDENTIALS[role];
  console.log(`\nLogging in as ${role}: ${cred.email}`);
  
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(2000);
  
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  await emailInput.click({ clickCount: 3 });
  await emailInput.fill(cred.email);
  
  const passInput = page.locator('input[type="password"]').first();
  await passInput.click({ clickCount: 3 });
  await passInput.fill(cred.password);
  
  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForTimeout(3000);
  
  const currentUrl = page.url();
  console.log(`Redirected to: ${currentUrl}`);
  return !currentUrl.includes('/login');
}

async function visitAndScreenshot(page, url, name, description, waitMs = 2000) {
  try {
    await page.goto(`${BASE_URL}${url}`);
    await page.waitForTimeout(waitMs);
    await screenshot(page, name, description);
  } catch (e) {
    console.log(`FAIL navigate to ${url}: ${e.message}`);
  }
}

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // GUEST PAGES
  console.log('\n=== GUEST PAGES ===');
  await visitAndScreenshot(page, '/', '01_home', 'Home Page', 3000);
  await visitAndScreenshot(page, '/services', '02_services', 'Services List');
  await visitAndScreenshot(page, '/packages', '03_packages', 'Packages List');
  await visitAndScreenshot(page, '/technicians', '04_technicians', 'Technicians Page');
  await visitAndScreenshot(page, '/promotions', '05_promotions', 'Promotions Page');
  await visitAndScreenshot(page, '/login', '06_login', 'Login Page');
  await visitAndScreenshot(page, '/register', '07_register', 'Register Page');
  await visitAndScreenshot(page, '/forgot-password', '08_forgot_password', 'Forgot Password Page');

  // CUSTOMER PAGES
  console.log('\n=== CUSTOMER PAGES ===');
  const customerLoggedIn = await login(page, 'customer');
  if (customerLoggedIn) {
    await visitAndScreenshot(page, '/customer/dashboard', '09_customer_dashboard', 'Customer Dashboard', 3000);
    await visitAndScreenshot(page, '/customer/book', '10_customer_booking', 'Booking Page', 3000);
    await visitAndScreenshot(page, '/customer/appointments', '11_customer_appointments', 'My Appointments');
    await visitAndScreenshot(page, '/customer/packages', '12_customer_packages', 'Customer Packages');
    await visitAndScreenshot(page, '/customer/membership', '13_customer_membership', 'Membership Page');
    await visitAndScreenshot(page, '/customer/vouchers', '14_customer_vouchers', 'Vouchers Page');
    await visitAndScreenshot(page, '/customer/notifications', '15_customer_notifications', 'Notifications');
    await visitAndScreenshot(page, '/customer/profile', '16_customer_profile', 'Customer Profile');
    await visitAndScreenshot(page, '/customer/ai-assistant', '17_customer_ai_assistant', 'AI Assistant', 3000);
    await visitAndScreenshot(page, '/customer/skin-analyzer', '18_customer_skin_analyzer', 'Skin Analyzer');
    await visitAndScreenshot(page, '/customer/ai-stylist', '18b_stylist_advisor', 'Stylist Advisor');
    await visitAndScreenshot(page, '/customer/service-history', '19_service_history', 'Service History');
    await visitAndScreenshot(page, '/customer/payment-history', '19b_payment_history', 'Payment History');
    await visitAndScreenshot(page, '/customer/waiting-list', '19c_waiting_list', 'Waiting List');
  } else {
    console.log('Customer login FAILED - skipping');
  }

  await context.clearCookies();

  // RECEPTIONIST PAGES
  console.log('\n=== RECEPTIONIST PAGES ===');
  const recLoggedIn = await login(page, 'receptionist');
  if (recLoggedIn) {
    await visitAndScreenshot(page, '/receptionist/dashboard', '20_receptionist_dashboard', 'Receptionist Dashboard', 3000);
    await visitAndScreenshot(page, '/receptionist/appointments', '21_receptionist_appointments', 'Appointments');
    await visitAndScreenshot(page, '/receptionist/create-appointment', '22_create_appointment', 'Create Appointment');
    await visitAndScreenshot(page, '/receptionist/technician-dispatcher', '23_technician_dispatcher', 'Technician Dispatcher', 3000);
    await visitAndScreenshot(page, '/receptionist/invoices', '24_invoices', 'Invoices');
    await visitAndScreenshot(page, '/receptionist/waiting-list', '25_waiting_list', 'Waiting List');
    await visitAndScreenshot(page, '/receptionist/reschedule-requests', '26_reschedule_requests', 'Reschedule Requests');
    await visitAndScreenshot(page, '/receptionist/packages', '27_packages', 'Packages');
    await visitAndScreenshot(page, '/receptionist/customers', '28_customers', 'Customers');
  } else {
    console.log('Receptionist login FAILED');
  }

  await context.clearCookies();

  // TECHNICIAN PAGES
  console.log('\n=== TECHNICIAN PAGES ===');
  const techLoggedIn = await login(page, 'technician');
  if (techLoggedIn) {
    await visitAndScreenshot(page, '/technician/dashboard', '29_technician_dashboard', 'Dashboard', 3000);
    await visitAndScreenshot(page, '/technician/schedule', '30_technician_schedule', 'Work Schedule');
    await visitAndScreenshot(page, '/technician/appointments', '31_technician_appointments', 'Appointments');
    await visitAndScreenshot(page, '/technician/customers', '32_technician_customers', 'Customers');
    await visitAndScreenshot(page, '/technician/earnings', '33_technician_earnings', 'Earnings');
    await visitAndScreenshot(page, '/technician/attendance', '34_technician_attendance', 'Attendance');
    await visitAndScreenshot(page, '/technician/reviews', '35_technician_reviews', 'Reviews');
    await visitAndScreenshot(page, '/technician/profile', '36_technician_profile', 'Profile');
  } else {
    console.log('Technician login FAILED');
  }

  await context.clearCookies();

  // ADMIN PAGES
  console.log('\n=== ADMIN PAGES ===');
  const adminLoggedIn = await login(page, 'admin');
  if (adminLoggedIn) {
    await visitAndScreenshot(page, '/admin/dashboard', '37_admin_dashboard', 'Admin Dashboard', 3000);
    await visitAndScreenshot(page, '/admin/employees', '38_admin_employees', 'Employees');
    await visitAndScreenshot(page, '/admin/work-shifts', '39_admin_workshift', 'Work Shifts');
    await visitAndScreenshot(page, '/admin/services', '40_admin_services', 'Services');
    await visitAndScreenshot(page, '/admin/service-categories', '41_admin_service_categories', 'Service Categories');
    await visitAndScreenshot(page, '/admin/packages', '42_admin_packages', 'Packages');
    await visitAndScreenshot(page, '/admin/promotions', '43_admin_promotions', 'Promotions');
    await visitAndScreenshot(page, '/admin/vouchers', '44_admin_vouchers', 'Vouchers');
    await visitAndScreenshot(page, '/admin/memberships', '45_admin_memberships', 'Memberships');
    await visitAndScreenshot(page, '/admin/customers', '46_admin_customers', 'Customers');
    await visitAndScreenshot(page, '/admin/reviews', '47_admin_reviews', 'Reviews');
    await visitAndScreenshot(page, '/admin/feedbacks', '48_admin_feedbacks', 'Feedbacks');
    await visitAndScreenshot(page, '/admin/refunds', '49_admin_refunds', 'Refunds');
    await visitAndScreenshot(page, '/admin/ai-crm', '50_admin_ai_crm', 'AI CRM', 3000);
    await visitAndScreenshot(page, '/admin/ai-monitoring', '51_admin_ai_monitoring', 'AI Monitoring');
    await visitAndScreenshot(page, '/admin/system-logs', '52_admin_system_logs', 'System Logs');
    await visitAndScreenshot(page, '/admin/reports', '53_admin_reports', 'Reports');
  } else {
    console.log('Admin login FAILED');
  }

  await browser.close();
  
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\nDONE! ${files.length} screenshots saved to: ${OUTPUT_DIR}`);
  files.forEach(f => console.log(`  - ${f}`));
}

main().catch(console.error);
