import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import { ApiError } from './client'
import { TextField } from './fields'
import { FormDialog } from './FormDialog'

type Values = { name: string; email: string }

function Example({ onSave, onClosed }: { onSave: (values: Values) => Promise<unknown>; onClosed: () => void }) {
  const form = useForm<Values>({ defaultValues: { name: 'Priya Nair', email: '' } })
  const { errors } = form.formState
  return (
    <FormDialog title="Edit contact" submit="Save changes" form={form} onSave={onSave} onClosed={onClosed}>
      <TextField label="Name" error={errors.name?.message} {...form.register('name', { required: 'Enter a name.' })} />
      <TextField label="Email" error={errors.email?.message} {...form.register('email')} />
    </FormDialog>
  )
}

function show(onSave = vi.fn(async (_values: Values) => {})) {
  const onClosed = vi.fn()
  const pages = [
    { path: '/', element: <p>The page before</p> },
    { path: '/form', element: <Example onSave={onSave} onClosed={onClosed} /> },
  ]
  const router = createMemoryRouter(pages, { initialEntries: ['/', '/form'], initialIndex: 1 })
  render(<RouterProvider router={router} />)
  const back = () => act(() => router.navigate(-1))
  return { onSave, onClosed, back, user: userEvent.setup() }
}

const name = () => screen.getByRole('textbox', { name: 'Name' })
const save = () => screen.getByRole('button', { name: 'Save changes' })
const cancel = () => screen.getByRole('button', { name: 'Cancel' })

test('saves what was entered, then closes', async () => {
  const { user, onSave, onClosed } = show()
  await user.clear(name())
  await user.type(name(), 'Wen Zhao')
  await user.click(save())
  expect(onSave.mock.calls[0]![0]).toEqual({ name: 'Wen Zhao', email: '' })
  await waitFor(() => expect(onClosed).toHaveBeenCalledOnce())
})

test('shows a problem beside its field and sends nothing', async () => {
  const { user, onSave, onClosed } = show()
  await user.clear(name())
  await user.click(save())
  expect(name()).toHaveAccessibleDescription('Enter a name.')
  expect(name()).toBeInvalid()
  expect(name()).toHaveFocus()
  expect(onSave).not.toHaveBeenCalled()
  expect(onClosed).not.toHaveBeenCalled()
})

test("shows the server's problems beside their fields", async () => {
  const { user, onClosed } = show(
    vi.fn(async () => {
      throw new ApiError('invalid', 'Not valid', { email: 'Enter an email address.' })
    }),
  )
  await user.click(save())
  expect(await screen.findByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription('Enter an email address.')
  expect(onClosed).not.toHaveBeenCalled()
})

test.each([
  ['no field', new ApiError('unreachable', "The server can't be reached.")],
  ['a field that is not here', new ApiError('invalid', "The server can't be reached.", { other: 'Wrong.' })],
])('says why it was not saved, with %s', async (_what, error) => {
  const { user, onClosed } = show(
    vi.fn(async () => {
      throw error
    }),
  )
  await user.type(name(), ' Jr')
  await user.click(save())
  expect(await screen.findByRole('alert')).toHaveTextContent("Not saved. The server can't be reached.")
  expect(name()).toHaveValue('Priya Nair Jr')
  expect(onClosed).not.toHaveBeenCalled()
})

test('closes at once when nothing was changed', async () => {
  const { user, onClosed } = show()
  await user.click(cancel())
  await waitFor(() => expect(onClosed).toHaveBeenCalledOnce())
})

test.each(['the button', 'Escape'])('asks before losing changes, closed by %s', async (how) => {
  const { user, onClosed, onSave } = show()
  await user.type(name(), ' Jr')
  const close = () => (how === 'Escape' ? user.keyboard('{Escape}') : user.click(cancel()))

  await close()
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard your changes?')
  await user.click(screen.getByRole('button', { name: 'Keep editing' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(name()).toHaveValue('Priya Nair Jr')

  await close()
  await user.click(await screen.findByRole('button', { name: 'Discard changes' }))
  await waitFor(() => expect(onClosed).toHaveBeenCalledOnce())
  expect(onSave).not.toHaveBeenCalled()
})

/** Whether the browser is asked to ask before leaving Accountable. */
const asksBeforeLeaving = () => !window.dispatchEvent(new Event('beforeunload', { cancelable: true }))

test('asks before losing changes, going back', async () => {
  const { user, back, onSave } = show()
  expect(asksBeforeLeaving()).toBe(false)
  await user.type(name(), ' Jr')
  expect(asksBeforeLeaving()).toBe(true)

  await back()
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard your changes?')
  await user.click(screen.getByRole('button', { name: 'Keep editing' }))
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(name()).toHaveValue('Priya Nair Jr')

  await back()
  await user.click(await screen.findByRole('button', { name: 'Discard changes' }))
  expect(await screen.findByText('The page before')).toBeVisible()
  expect(asksBeforeLeaving()).toBe(false)
  expect(onSave).not.toHaveBeenCalled()
})

test('goes back at once when nothing was changed', async () => {
  const { back } = show()
  await back()
  expect(await screen.findByText('The page before')).toBeVisible()
})

test('going back waits while it is being saved', async () => {
  let finish = () => {}
  const { user, back, onClosed } = show(vi.fn(() => new Promise<void>((resolve) => (finish = resolve))))
  await user.type(name(), ' Jr')
  await user.click(save())
  await back()
  expect(screen.queryByRole('alertdialog')).toBeNull()
  expect(screen.getByRole('button', { name: 'Saving' })).toBeVisible()
  finish()
  await waitFor(() => expect(onClosed).toHaveBeenCalledOnce())
  await back()
  expect(await screen.findByText('The page before')).toBeVisible()
})

test('saves once, however often the button is pressed', async () => {
  let finish = () => {}
  const { user, onSave, onClosed } = show(vi.fn(() => new Promise<void>((resolve) => (finish = resolve))))
  await user.click(save())
  await user.click(screen.getByRole('button', { name: 'Saving' }))
  await user.keyboard('{Escape}')
  expect(onSave).toHaveBeenCalledOnce()
  expect(onClosed).not.toHaveBeenCalled()
  finish()
  await waitFor(() => expect(onClosed).toHaveBeenCalledOnce())
})
