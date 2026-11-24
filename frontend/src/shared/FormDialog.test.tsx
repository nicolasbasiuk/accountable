import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
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
  render(<Example onSave={onSave} onClosed={onClosed} />)
  return { onSave, onClosed, user: userEvent.setup() }
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
