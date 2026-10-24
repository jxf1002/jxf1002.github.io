import { Button } from "./ui/button"

export default function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}) {
  return (
    <div className="pagination" data-pagination>
      <Button
        variant="ghost"
        data-prev
        type="button"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        上一页
      </Button>
      <span>
        第 {page} / {totalPages} 页，共 {total} 条
      </span>
      <Button
        variant="ghost"
        data-next
        type="button"
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
      >
        下一页
      </Button>
    </div>
  )
}
