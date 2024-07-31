import { sql } from '@vercel/postgres';
import {
  CustomerField,
  CustomersTableType,
  InvoiceForm,
  InvoicesTable,
  LatestInvoiceRaw,
  Revenue,
  //New Kanban ones
  User,
  Company,
  UserRole,
  Project,
  Record,
  Task,
  Invitation,
  Comment,
} from './definitions';
import { formatCurrency } from './utils';


import { v4 as uuidv4 } from 'uuid'; // To generate UUIDs for new entries


export async function fetchRevenue() {
  try {
    // Artificially delay a response for demo purposes.
    // Don't do this in production :)

    // console.log('Fetching revenue data...');
    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const data = await sql<Revenue>`SELECT * FROM revenue`;

    // console.log('Data fetch completed after 3 seconds.');

    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch revenue data.');
  }
}

export async function fetchLatestInvoices() {
  try {
    const data = await sql<LatestInvoiceRaw>`
      SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      ORDER BY invoices.date DESC
      LIMIT 5`;

    const latestInvoices = data.rows.map((invoice) => ({
      ...invoice,
      amount: formatCurrency(invoice.amount),
    }));
    return latestInvoices;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch the latest invoices.');
  }
}

export async function fetchCardData() {
  try {
    // You can probably combine these into a single SQL query
    // However, we are intentionally splitting them to demonstrate
    // how to initialize multiple queries in parallel with JS.
    const invoiceCountPromise = sql`SELECT COUNT(*) FROM invoices`;
    const customerCountPromise = sql`SELECT COUNT(*) FROM customers`;
    const invoiceStatusPromise = sql`SELECT
         SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS "paid",
         SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS "pending"
         FROM invoices`;

    const data = await Promise.all([
      invoiceCountPromise,
      customerCountPromise,
      invoiceStatusPromise,
    ]);

    const numberOfInvoices = Number(data[0].rows[0].count ?? '0');
    const numberOfCustomers = Number(data[1].rows[0].count ?? '0');
    const totalPaidInvoices = formatCurrency(data[2].rows[0].paid ?? '0');
    const totalPendingInvoices = formatCurrency(data[2].rows[0].pending ?? '0');

    return {
      numberOfCustomers,
      numberOfInvoices,
      totalPaidInvoices,
      totalPendingInvoices,
    };
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch card data.');
  }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
) {
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    const invoices = await sql<InvoicesTable>`
      SELECT
        invoices.id,
        invoices.amount,
        invoices.date,
        invoices.status,
        customers.name,
        customers.email,
        customers.image_url
      FROM invoices
      JOIN customers ON invoices.customer_id = customers.id
      WHERE
        customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`} OR
        invoices.amount::text ILIKE ${`%${query}%`} OR
        invoices.date::text ILIKE ${`%${query}%`} OR
        invoices.status ILIKE ${`%${query}%`}
      ORDER BY invoices.date DESC
      LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
    `;

    return invoices.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoices.');
  }
}

export async function fetchInvoicesPages(query: string) {
  try {
    const count = await sql`SELECT COUNT(*)
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE
      customers.name ILIKE ${`%${query}%`} OR
      customers.email ILIKE ${`%${query}%`} OR
      invoices.amount::text ILIKE ${`%${query}%`} OR
      invoices.date::text ILIKE ${`%${query}%`} OR
      invoices.status ILIKE ${`%${query}%`}
  `;

    const totalPages = Math.ceil(Number(count.rows[0].count) / ITEMS_PER_PAGE);
    return totalPages;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch total number of invoices.');
  }
}

export async function fetchInvoiceById(id: string) {
  try {
    const data = await sql<InvoiceForm>`
      SELECT
        invoices.id,
        invoices.customer_id,
        invoices.amount,
        invoices.status
      FROM invoices
      WHERE invoices.id = ${id};
    `;

    const invoice = data.rows.map((invoice) => ({
      ...invoice,
      // Convert amount from cents to dollars
      amount: invoice.amount / 100,
    }));

    return invoice[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invoice.');
  }
}

export async function fetchCustomers() {
  try {
    const data = await sql<CustomerField>`
      SELECT
        id,
        name
      FROM customers
      ORDER BY name ASC
    `;

    const customers = data.rows;
    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch all customers.');
  }
}

export async function fetchFilteredCustomers(query: string) {
  try {
    const data = await sql<CustomersTableType>`
		SELECT
		  customers.id,
		  customers.name,
		  customers.email,
		  customers.image_url,
		  COUNT(invoices.id) AS total_invoices,
		  SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		  SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		FROM customers
		LEFT JOIN invoices ON customers.id = invoices.customer_id
		WHERE
		  customers.name ILIKE ${`%${query}%`} OR
        customers.email ILIKE ${`%${query}%`}
		GROUP BY customers.id, customers.name, customers.email, customers.image_url
		ORDER BY customers.name ASC
	  `;

    const customers = data.rows.map((customer) => ({
      ...customer,
      total_pending: formatCurrency(customer.total_pending),
      total_paid: formatCurrency(customer.total_paid),
    }));

    return customers;
  } catch (err) {
    console.error('Database Error:', err);
    throw new Error('Failed to fetch customer table.');
  }
}

//Start of KanBan functions
// User Management
export async function createUser(username: string, email: string, passwordHash: string) {
  try {
    const id = uuidv4();
    await sql`INSERT INTO userz (id, username, email, password_hash, created_at)
              VALUES (${id}, ${username}, ${email}, ${passwordHash}, CURRENT_TIMESTAMP)`;
    return id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create user.');
  }
}

export async function fetchUserById(id: string) {
  try {
    const data = await sql<User>`SELECT * FROM userz WHERE id = ${id}`;
    return data.rows[0];
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch user.');
  }
}

// Company Management
export async function createCompany(name: string, createdBy: string) {
  try {
    const id = uuidv4();
    await sql`INSERT INTO companies (id, name, created_by, created_at)
              VALUES (${id}, ${name}, ${createdBy}, CURRENT_TIMESTAMP)`;
    return id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create company.');
  }
}

export async function fetchCompanies() {
  try {
    const data = await sql<Company>`SELECT * FROM companies ORDER BY name ASC`;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch companies.');
  }
}

// User Roles Management
export async function addUserToCompany(userId: string, companyId: string, role: string) {
  try {
    const id = uuidv4();
    await sql`INSERT INTO user_roles (id, user_id, company_id, role, joined_at)
              VALUES (${id}, ${userId}, ${companyId}, ${role}, CURRENT_TIMESTAMP)`;
    return id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to add user to company.');
  }
}

export async function fetchUserRoles(userId: string) {
  try {
    const data = await sql<UserRole>`SELECT * FROM user_roles WHERE user_id = ${userId}`;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch user roles.');
  }
}

// Project Management
export async function createProject(companyId: string, name: string, description: string) {
  try {
    const id = uuidv4();
    await sql`INSERT INTO projects (id, company_id, name, description, created_at)
              VALUES (${id}, ${companyId}, ${name}, ${description}, CURRENT_TIMESTAMP)`;
    return id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create project.');
  }
}

export async function fetchProjects(companyId: string) {
  try {
    const data = await sql<Project>`SELECT * FROM projects WHERE company_id = ${companyId} ORDER BY created_at DESC`;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch projects.');
  }
}

// Record Management
export async function createRecord(projectId: string, name: string, description: string) {
  try {
    const id = uuidv4();
    await sql`INSERT INTO records (id, project_id, name, description, created_at)
              VALUES (${id}, ${projectId}, ${name}, ${description}, CURRENT_TIMESTAMP)`;
    return id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create record.');
  }
}

export async function fetchRecords(projectId: string) {
  try {
    const data = await sql<Record>`SELECT * FROM records WHERE project_id = ${projectId} ORDER BY created_at DESC`;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch records.');
  }
}

// Task Management
export async function createTask(recordId: string, name: string, description: string, assignedTo: string, dueDate: Date) {
  try {
    const id = uuidv4();
     // Convert dueDate to ISO string format
     const dueDateISO = dueDate.toISOString();
    await sql`INSERT INTO tasks (id, record_id, name, description, status, assigned_to, due_date, created_at)
              VALUES (${id}, ${recordId}, ${name}, ${description}, 'To Do', ${assignedTo}, ${dueDateISO}, CURRENT_TIMESTAMP)`;
    return id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create task.');
  }
}

export async function fetchTasks(recordId: string) {
  try {
    const data = await sql<Task>`SELECT * FROM tasks WHERE record_id = ${recordId} ORDER BY created_at DESC`;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch tasks.');
  }
}

// Invitation Management
export async function createInvitation(companyId: string, email: string, token: string, expiresAt: Date) {
  try {
    const id = uuidv4();
     
    // Convert exirestAt to ISO string format
     const expiresAtISO = expiresAt.toISOString();
    await sql`INSERT INTO invitations (id, company_id, email, token, expires_at, status)
              VALUES (${id}, ${companyId}, ${email}, ${token}, ${expiresAtISO}, 'Pending')`;
    return id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create invitation.');
  }
}

export async function fetchInvitations(companyId: string) {
  try {
    const data = await sql<Invitation>`SELECT * FROM invitations WHERE company_id = ${companyId} ORDER BY expires_at DESC`;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch invitations.');
  }
}

// Comment Management
export async function createComment(taskId: string, userId: string, content: string) {
  try {
    const id = uuidv4();
    await sql`INSERT INTO comments (id, task_id, user_id, content, created_at)
              VALUES (${id}, ${taskId}, ${userId}, ${content}, CURRENT_TIMESTAMP)`;
    return id;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to create comment.');
  }
}

export async function fetchComments(taskId: string) {
  try {
    const data = await sql<Comment>`SELECT * FROM comments WHERE task_id = ${taskId} ORDER BY created_at ASC`;
    return data.rows;
  } catch (error) {
    console.error('Database Error:', error);
    throw new Error('Failed to fetch comments.');
  }
}