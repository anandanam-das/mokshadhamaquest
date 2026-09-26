let adminUsers = [];

function getCharacterTitle(planetId) {
  const character = MOKSHA_CHARACTERS.find((item) => item.id === planetId);
  return character ? character.title : (planetId || '—');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateSummary() {
  document.getElementById('statTotalUsers').textContent = adminUsers.length;
  document.getElementById('statCertificates').textContent = adminUsers.filter((u) => u.hasCertificate).length;
  const avg = adminUsers.length
    ? Math.round(
        adminUsers.reduce((sum, u) => sum + u.doneTasks / u.totalTasks, 0) / adminUsers.length * 100
      )
    : 0;
  document.getElementById('statAvgProgress').textContent = `${avg}%`;
  document.getElementById('adminStatus').textContent = `Данные по всем зарегистрированным участникам (${adminUsers.length})`;
}

function renderViewRow(user) {
  const row = document.createElement('tr');
  row.dataset.telegramId = user.telegramId;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  row.innerHTML = `
    <td>${fullName}</td>
    <td>${user.telegramId}</td>
    <td>${user.email || '—'}</td>
    <td>${getCharacterTitle(user.patronPlanet)}</td>
    <td>${user.donePlanets}/${user.totalPlanets}</td>
    <td>${user.doneLessons}/${user.totalLessons}</td>
    <td>${user.doneTasks}/${user.totalTasks}</td>
    <td>${user.hasCertificate ? '✓' : '—'}</td>
    <td>${formatDate(user.createdAt)}</td>
    <td class="admin-table-actions">
      <button type="button" class="admin-row-btn" data-action="edit">✏️ Изменить</button>
      <button type="button" class="admin-row-btn admin-row-btn-danger" data-action="delete">🗑 Удалить</button>
    </td>
  `;

  row.querySelector('[data-action="edit"]').addEventListener('click', () => {
    row.replaceWith(renderEditRow(user));
  });
  row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
    const fullNameForConfirm = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.telegramId;
    if (!confirm(`Удалить ${fullNameForConfirm} (${user.telegramId}) из базы? Это необратимо.`)) return;
    try {
      await deleteAdminUser(user.telegramId);
      adminUsers = adminUsers.filter((u) => u.telegramId !== user.telegramId);
      row.remove();
      updateSummary();
    } catch (error) {
      alert('Не удалось удалить пользователя. Попробуйте ещё раз.');
    }
  });

  return row;
}

function renderEditRow(user) {
  const row = document.createElement('tr');
  row.dataset.telegramId = user.telegramId;

  const patronOptions = MOKSHA_CHARACTERS.map(
    (c) => `<option value="${c.id}" ${c.id === user.patronPlanet ? 'selected' : ''}>${c.title}</option>`
  ).join('');

  row.innerHTML = `
    <td><input type="text" class="admin-edit-input" data-field="firstName" value="${user.firstName || ''}" placeholder="Имя" /></td>
    <td>${user.telegramId}</td>
    <td><input type="email" class="admin-edit-input" data-field="email" value="${user.email || ''}" placeholder="Почта" /></td>
    <td>
      <select class="admin-edit-input" data-field="patronPlanet">
        <option value="">—</option>
        ${patronOptions}
      </select>
    </td>
    <td>${user.donePlanets}/${user.totalPlanets}</td>
    <td>${user.doneLessons}/${user.totalLessons}</td>
    <td>${user.doneTasks}/${user.totalTasks}</td>
    <td>${user.hasCertificate ? '✓' : '—'}</td>
    <td>${formatDate(user.createdAt)}</td>
    <td class="admin-table-actions">
      <button type="button" class="admin-row-btn" data-action="save">💾 Сохранить</button>
      <button type="button" class="admin-row-btn" data-action="cancel">Отмена</button>
    </td>
  `;
  // Отдельное поле для фамилии не поместилось бы в колонку "Имя" — второй
  // input добавляем туда же, под первым.
  const firstNameCell = row.children[0];
  const lastNameInput = document.createElement('input');
  lastNameInput.type = 'text';
  lastNameInput.className = 'admin-edit-input';
  lastNameInput.dataset.field = 'lastName';
  lastNameInput.value = user.lastName || '';
  lastNameInput.placeholder = 'Фамилия';
  firstNameCell.appendChild(lastNameInput);

  row.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    row.replaceWith(renderViewRow(user));
  });

  row.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const patch = {
      firstName: row.querySelector('[data-field="firstName"]').value.trim(),
      lastName: row.querySelector('[data-field="lastName"]').value.trim(),
      email: row.querySelector('[data-field="email"]').value.trim(),
      patronPlanet: row.querySelector('[data-field="patronPlanet"]').value || null,
    };
    try {
      const updated = await updateAdminUser(user.telegramId, patch);
      const merged = {
        ...user,
        firstName: updated.first_name,
        lastName: updated.last_name,
        email: updated.email,
        patronPlanet: updated.patron_planet,
      };
      adminUsers = adminUsers.map((u) => (u.telegramId === user.telegramId ? merged : u));
      row.replaceWith(renderViewRow(merged));
    } catch (error) {
      alert('Не удалось сохранить изменения. Попробуйте ещё раз.');
    }
  });

  return row;
}

function renderAdminTable(overview) {
  adminUsers = overview.users;
  updateSummary();

  const tbody = document.getElementById('adminTableBody');
  tbody.innerHTML = '';
  adminUsers.forEach((user) => tbody.appendChild(renderViewRow(user)));

  document.getElementById('adminSummary').hidden = false;
  document.getElementById('adminTableWrap').hidden = false;
}

document.addEventListener('DOMContentLoaded', async () => {
  const state = getUserState();
  const statusEl = document.getElementById('adminStatus');

  if (!state.telegramId || !isAdminTelegramId(state.telegramId)) {
    window.location.href = 'login.html';
    return;
  }

  try {
    const overview = await fetchAdminOverview();
    renderAdminTable(overview);
  } catch (error) {
    statusEl.textContent = 'Не удалось загрузить данные. Обновите страницу или попробуйте позже.';
  }
});
