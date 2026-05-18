import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function DataTable<T>({
  columns,
  data,
  empty,
}: {
  columns: { key: string; header: string; render: (row: T) => React.ReactNode }[]
  data: T[]
  empty?: React.ReactNode
}) {
  if (data.length === 0 && empty) return <>{empty}</>

  return (
    <div className="overflow-x-auto rounded-[1.5rem] border-2 border-slate-200 bg-white shadow-[0_6px_0_#e2e8f0]">
    <Table>
      <TableHeader>
        <TableRow className="bg-lime-50">
          {columns.map((column) => (
            <TableHead key={column.key} className="whitespace-nowrap text-xs font-black uppercase tracking-wide text-slate-500">{column.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, rowIndex) => (
          <TableRow key={rowIndex} className="transition hover:bg-lime-50">
            {columns.map((column) => (
              <TableCell key={column.key} className="align-middle">{column.render(row)}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  )
}
